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
import { listAllAccounts, getAnalytics, extractFollowerCount } from "@/lib/zernio/client";

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

    // Fetch ALL org accounts from Zernio once (shared across all users)
    let allZernioAccounts;
    try {
      allZernioAccounts = await listAllAccounts();
      console.log(`[Cron:sync-analytics] Fetched ${allZernioAccounts.length} total org accounts from Zernio`);
    } catch (e) {
      console.error("[Cron:sync-analytics] FAILED to fetch org accounts:", e);
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    // Build a lookup: zernioAccountId → ZernioAccount
    const zernioAccountMap = new Map(
      allZernioAccounts.map((a) => [a._id, a])
    );

    for (const user of activeUsers) {
      if (!user.zernioProfileKey) continue;

      console.log(`[Cron:sync-analytics] Syncing user ${user.id} (${user.email})`);

      try {
        // Read this user's connected accounts from OUR DB — this is the tenant boundary
        const userDbAccounts = await db
          .select()
          .from(connectedAccounts)
          .where(eq(connectedAccounts.userId, user.id));

        const userAccountIds = new Set(
          userDbAccounts
            .map((a) => a.zernioAccountId)
            .filter((id): id is string => id !== null)
        );

        console.log(
          `[Cron:sync-analytics] User ${user.email} owns ${userAccountIds.size} accounts in DB: [${[...userAccountIds].join(", ")}]`
        );

        if (userAccountIds.size === 0) {
          console.log(`[Cron:sync-analytics] Skipping user ${user.email} — no connected accounts`);
          continue;
        }

        // Update account stats from Zernio data
        for (const dbAccount of userDbAccounts) {
          if (!dbAccount.zernioAccountId) continue;
          const zAcct = zernioAccountMap.get(dbAccount.zernioAccountId);
          if (!zAcct) continue;

          const followers = extractFollowerCount(zAcct);
          const following = zAcct.metadata?.profileData?.extraData?.followsCount || 0;
          const totalPosts = zAcct.metadata?.profileData?.extraData?.mediaCount || 0;

          await db
            .update(connectedAccounts)
            .set({
              platformUsername: zAcct.username || dbAccount.platformUsername,
              platformDisplayName: zAcct.displayName,
              platformAvatarUrl: zAcct.profilePicture || dbAccount.platformAvatarUrl,
              followerCount: followers,
              followingCount: following,
              totalPosts: totalPosts,
              lastSyncedAt: new Date(),
            })
            .where(eq(connectedAccounts.id, dbAccount.id));

          // Snapshot account analytics
          await db.insert(accountAnalytics).values({
            connectedAccountId: dbAccount.id,
            followerCount: followers,
            followingCount: following,
            totalPosts: totalPosts,
          });
        }

        // Sync post analytics — pull last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fromDate = thirtyDaysAgo.toISOString().split("T")[0];
        const toDate = now.toISOString().split("T")[0];

        try {
          const analyticsData = await getAnalytics({ fromDate, toDate, limit: 100 });
          const allEntries = analyticsData.posts || [];

          // TENANT FILTER: Use our DB's account ownership, NOT Zernio's profileId.
          // An analytics entry belongs to this user if any of its platform accountIds
          // are in the user's connected_accounts.
          const postEntries = allEntries.filter((entry) => {
            if (entry.platforms?.some((p) => userAccountIds.has(p.accountId))) return true;
            return false;
          });

          const discardedAnalytics = allEntries.length - postEntries.length;
          if (discardedAnalytics > 0) {
            console.log(
              `[Cron:sync-analytics] Tenant filter: kept ${postEntries.length}/${allEntries.length} analytics entries for ${user.email} (discarded ${discardedAnalytics} belonging to other users)`
            );
          }
          console.log(`[Cron:sync-analytics] Got ${postEntries.length} analytics entries for date range ${fromDate} to ${toDate}`);

          let newCount = 0;
          let updatedCount = 0;
          for (const entry of postEntries) {
            try {
              const zernioPostId = entry.latePostId || entry._id;
              if (!zernioPostId) continue;

              // Find or create the post in our DB
              let [post] = await db
                .select()
                .from(posts)
                .where(
                  and(
                    eq(posts.userId, user.id),
                    eq(posts.zernioPostId, zernioPostId)
                  )
                )
                .limit(1);

              if (!post) {
                // Auto-import post from Zernio
                const platformNames = entry.platforms?.map((p) => p.platform) || [];
                if (platformNames.length === 0 && entry.platform) {
                  platformNames.push(entry.platform);
                }
                const createdAt = entry.publishedAt
                  ? new Date(entry.publishedAt)
                  : new Date();

                const [inserted] = await db
                  .insert(posts)
                  .values({
                    userId: user.id,
                    content: (entry.content || "").slice(0, 2000),
                    mediaUrls: [],
                    platforms: platformNames.length > 0 ? platformNames : ["unknown"],
                    status: "published",
                    zernioPostId,
                    syncedFromZernio: true,
                    createdAt,
                    updatedAt: createdAt,
                  })
                  .returning();
                post = inserted;
                newCount++;
              } else {
                updatedCount++;
              }

              // Insert per-platform analytics breakdowns
              if (entry.platforms && entry.platforms.length > 0) {
                for (const plat of entry.platforms) {
                  const m = plat.analytics;
                  await db.insert(postAnalytics).values({
                    postId: post.id,
                    platform: plat.platform,
                    likes: m.likes || 0,
                    comments: m.comments || 0,
                    shares: m.shares || 0,
                    views: m.views || 0,
                    saves: m.saves || 0,
                    reach: m.reach || 0,
                    impressions: m.impressions || 0,
                    engagementRate: m.engagementRate || 0,
                  });
                }
              } else {
                // Fallback: use top-level analytics
                const m = entry.analytics;
                await db.insert(postAnalytics).values({
                  postId: post.id,
                  platform: entry.platform || post.platforms[0] || "unknown",
                  likes: m.likes || 0,
                  comments: m.comments || 0,
                  shares: m.shares || 0,
                  views: m.views || 0,
                  saves: m.saves || 0,
                  reach: m.reach || 0,
                  impressions: m.impressions || 0,
                  engagementRate: m.engagementRate || 0,
                });
              }
            } catch (entryErr) {
              console.error(`[Cron:sync-analytics] Failed to process entry ${entry._id}:`, entryErr);
            }
          }
          console.log(`[Cron:sync-analytics] Synced ${postEntries.length} posts (${newCount} new, ${updatedCount} updated) for user ${user.email}`);
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
