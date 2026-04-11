import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAllAccounts, extractFollowerCount } from "@/lib/zernio/client";
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
    // 1. Read this user's existing connected accounts from our DB
    const existingAccounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, user.id));

    const ownedAccountIds = new Set(
      existingAccounts.map((a) => a.zernioAccountId).filter(Boolean)
    );

    // 2. Read ALL users' claimed account IDs to avoid cross-tenant assignment
    const allClaimed = await db
      .select({ zernioAccountId: connectedAccounts.zernioAccountId })
      .from(connectedAccounts);
    const allClaimedIds = new Set(
      allClaimed.map((a) => a.zernioAccountId).filter(Boolean)
    );

    // 3. Fetch all accounts from Zernio (org-wide)
    const zernioAccounts = await listAllAccounts();
    console.log(
      `[Sync] Fetched ${zernioAccounts.length} org accounts; user ${user.email} owns ${ownedAccountIds.size} in DB`
    );

    let updatedCount = 0;
    let newCount = 0;

    for (const acct of zernioAccounts) {
      const followers = extractFollowerCount(acct);
      const following = acct.metadata?.profileData?.extraData?.followsCount || 0;
      const totalPosts = acct.metadata?.profileData?.extraData?.mediaCount || 0;

      if (ownedAccountIds.has(acct._id)) {
        // Account belongs to this user — update stats
        await db
          .update(connectedAccounts)
          .set({
            platformUsername: acct.username || undefined,
            platformDisplayName: acct.displayName,
            platformAvatarUrl: acct.profilePicture || undefined,
            followerCount: followers,
            followingCount: following,
            totalPosts: totalPosts,
            lastSyncedAt: new Date(),
          })
          .where(
            and(
              eq(connectedAccounts.userId, user.id),
              eq(connectedAccounts.zernioAccountId, acct._id)
            )
          );
        updatedCount++;
      } else if (!allClaimedIds.has(acct._id)) {
        // Account not claimed by ANY user — assign to current user.
        // This handles: (a) new accounts just connected through /connect,
        // (b) pre-existing accounts for first-time users (bward3321 bootstrap).
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
        allClaimedIds.add(acct._id); // Mark as claimed so we don't double-assign
        newCount++;
      }
      // else: account claimed by another user — skip
    }

    console.log(
      `[Sync] Updated ${updatedCount}, imported ${newCount} new accounts for ${user.email}`
    );

    // Return this user's accounts from our DB
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
