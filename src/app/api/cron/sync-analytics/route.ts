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
import { listAccounts, getAnalytics, extractFollowerCount } from "@/lib/zernio/client";

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
        // Fetch accounts scoped to THIS user's Zernio profile only
        let zernioAccounts;
        try {
          zernioAccounts = await listAccounts(user.zernioProfileKey!);
          console.log(`[Cron:sync-analytics] Fetched ${zernioAccounts.length} accounts for user ${user.id} (profile ${user.zernioProfileKey})`);
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

          const followers = extractFollowerCount(acct);
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

        // Build set of this user's Zernio account IDs for filtering analytics
        const userAccountIds = new Set(
          zernioAccounts.map((a) => a._id)
        );

        // Sync post analytics — pull last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fromDate = thirtyDaysAgo.toISOString().split("T")[0];
        const toDate = now.toISOString().split("T")[0];

        try {
          const analyticsData = await getAnalytics({ fromDate, toDate, limit: 100 });
          const allEntries = analyticsData.posts || [];

          // CRITICAL: Filter analytics to only posts belonging to this user's accounts/profile
          const postEntries = allEntries.filter((entry) => {
            // Check if profileId matches
            if (entry.profileId && entry.profileId === user.zernioProfileKey) return true;
            // Check if any platform accountId belongs to this user
            if (entry.platforms?.some((p) => userAccountIds.has(p.accountId))) return true;
            return false;
          });

          const discardedAnalytics = allEntries.length - postEntries.length;
          if (discardedAnalytics > 0) {
            console.error(
              `[Cron:sync-analytics] TENANT FILTER: Discarded ${discardedAnalytics} analytics entries not belonging to profile ${user.zernioProfileKey}. ` +
              `Kept ${postEntries.length}/${allEntries.length}.`
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
