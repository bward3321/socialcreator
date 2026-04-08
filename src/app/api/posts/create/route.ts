import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hasAccess } from "@/lib/auth";
import { createPost as createZernioPost } from "@/lib/zernio/client";
import { db } from "@/lib/db";
import { posts, connectedAccounts } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const schema = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1),
  scheduledFor: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAccess(user)) {
    return NextResponse.json({ error: "Trial expired" }, { status: 403 });
  }
  if (!user.zernioProfileKey) {
    return NextResponse.json({ error: "No Zernio profile" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { content, platforms, scheduledFor } = schema.parse(body);

    // Get connected accounts for selected platforms
    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, user.id),
          inArray(connectedAccounts.platform, platforms)
        )
      );

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No connected accounts for selected platforms" },
        { status: 400 }
      );
    }

    // Create post in our DB
    const [post] = await db
      .insert(posts)
      .values({
        userId: user.id,
        content,
        platforms,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        status: scheduledFor ? "scheduled" : "publishing",
      })
      .returning();

    // Create post via Zernio using stored account IDs
    const zernioPost = await createZernioPost({
      content,
      platforms: accounts.map((a) => ({
        platform: a.platform,
        accountId: a.zernioAccountId || a.platform,
      })),
      scheduledFor: scheduledFor || undefined,
      publishNow: !scheduledFor,
    });

    await db
      .update(posts)
      .set({
        zernioPostId: zernioPost._id,
        status: zernioPost.status === "published" ? "published" : scheduledFor ? "scheduled" : "publishing",
      })
      .where(eq(posts.id, post.id));

    return NextResponse.json({
      post: { ...post, zernioPostId: zernioPost._id },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    }
    console.error("Create post error:", e);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
