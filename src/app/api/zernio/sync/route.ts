import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts, extractFollowerCount } from "@/lib/zernio/client";
import { db } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.zernioProfileKey) {
    return NextResponse.json({ accounts: [] });
  }

  try {
    // Fetch accounts scoped to THIS user's Zernio profile only
    const zernioAccounts = await listAccounts(user.zernioProfileKey);
    console.log(`[Sync] Fetched ${zernioAccounts.length} accounts for profile ${user.zernioProfileKey}`);

    for (const acct of zernioAccounts) {
      // Match by zernioAccountId (unique per Zernio account)
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
      } else {
        await db.insert(connectedAccounts).values({
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
        });
      }
    }

    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, user.id));

    return NextResponse.json({ accounts });
  } catch (e) {
    console.error("Zernio sync error:", e);
    return NextResponse.json(
      { error: "Failed to sync accounts" },
      { status: 500 }
    );
  }
}
