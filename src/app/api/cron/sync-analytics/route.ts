import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  connectedAccounts,
  posts,
  postAnalytics,
  accountAnalytics,
} from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { listAccounts, getAnalytics } from "@/lib/zernio/client";

function verifyCron(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron:sync-analytics] Starting analytics sync...");

  try {
    // Get all active users with Zernio profiles
    const activeUsers = await db
      .select()
      .from(users)
      .where(isNotNull(users.zernioProfileKey));

    console.log(`[Cron:sync-analytics] Found ${activeUsers.length} users with Zernio profiles`);

    for (const user of activeUsers) {
      if (!user.zernioProfileKey) continue;

      console.log(`[Cron:sync-analytics] Syncing user ${user.id} (${user.email})`);

      try {
        // Fetch all accounts under this API key (accounts span multiple profiles)
        let zernioAccounts;
        try {
          zernioAccounts = await listAccounts();
          console.log(`[Cron:sync-analytics] Fetched ${zernioAccounts.length} accounts for user ${user.id}`);
        } catch (e) {
          console.error(`[Cron:sync-analytics] FAILED to fetch accounts for user ${user.id}:`, e);
          continue;
        }

        // Sync accounts
        for (const acct of zernioAccounts) {
          let [existing] = await db
            .select()
            .from(connectedAccounts)
            .where(
              and(
                eq(connectedAccounts.userId, user.id),
                eq(connectedAccounts.zernioAccountId, acct._id)
              )
            )
            .limit(1);

          const followers = acct.metadata?.profileData?.followersCount || 0;
          const following = acct.metadata?.profileData?.extraData?.followsCount || 0;
          const totalPosts = acct.metadata?.profileData?.extraData?.mediaCount || 0;

          if (existing) {
            await db
              .update(connectedAccounts)
              .set({
                zernioAccountId: acct._id,
                platformUsername: acct.username || existing.platformUsername,
                platformDisplayName: acct.displayName,
                platformAvatarUrl: acct.profilePicture || existing.platformAvatarUrl,
                followerCount: followers,
                followingCount: following,
                totalPosts: totalPosts,
                lastSyncedAt: new Date(),
              })
              .where(eq(connectedAccounts.id, existing.id));

            // Snapshot account analytics
            await db.insert(accountAnalytics).values({
              connectedAccountId: existing.id,
              followerCount: followers,
              followingCount: following,
              totalPosts: totalPosts,
            });
          } else {
            const [inserted] = await db
              .insert(connectedAccounts)
              .values({
                userId: user.id,
                platform: acct.platform,
                zernioAccountId: acct._id,
                platformUsername: acct.username || null,
                platformDisplayName: acct.displayName,
                platformAvatarUrl: acct.profilePicture || null,
                followerCount: followers,
                followingCount: following,
                totalPosts: totalPosts,
                lastSyncedAt: new Date(),
              })
              .returning();

            await db.insert(accountAnalytics).values({
              connectedAccountId: inserted.id,
              followerCount: followers,
              followingCount: following,
              totalPosts: totalPosts,
            });
          }
        }

        // Sync post analytics — pull last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fromDate = thirtyDaysAgo.toISOString().split("T")[0];
        const toDate = now.toISOString().split("T")[0];

        try {
          const analyticsData = await getAnalytics({ fromDate, toDate, limit: 100 });
          console.log(`[Cron:sync-analytics] Got ${analyticsData.length} analytics entries for date range ${fromDate} to ${toDate}`);

          for (const entry of analyticsData) {
            if (!entry.postId) continue;

            // Find the post in our DB by zernioPostId
            const [post] = await db
              .select()
              .from(posts)
              .where(
                and(
                  eq(posts.userId, user.id),
                  eq(posts.zernioPostId, entry.postId)
                )
              )
              .limit(1);

            if (post) {
              await db.insert(postAnalytics).values({
                postId: post.id,
                platform: entry.platform || post.platforms[0] || "unknown",
                likes: entry.likes || 0,
                comments: entry.comments || 0,
                shares: entry.shares || 0,
                views: entry.views || 0,
                saves: entry.saves || 0,
                reach: entry.reach || 0,
                impressions: entry.impressions || 0,
                engagementRate:
                  entry.impressions > 0
                    ? (entry.likes + entry.comments + entry.shares) / entry.impressions
                    : 0,
              });
            }
          }
        } catch (e) {
          console.error(`[Cron:sync-analytics] FAILED to fetch analytics for user ${user.id}:`, e);
        }
      } catch (e) {
        console.error(`[Cron:sync-analytics] FAILED to sync user ${user.id}:`, e);
      }
    }

    console.log("[Cron:sync-analytics] Sync complete");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Cron:sync-analytics] FATAL cron sync error:", e);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
