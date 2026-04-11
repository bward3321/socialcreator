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
  mediaUrls: z.array(z.string().url()).optional().default([]),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAccess(user)) {
    return NextResponse.json({ error: "Trial expired" }, { status: 403 });
  }
  if (!user.zernioProfileKey) {
    return NextResponse.json({ error: "No Zernio profile. Please reconnect your account." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { content, platforms, scheduledFor, mediaUrls } = schema.parse(body);

    // Get connected accounts for selected platforms — scoped to this user
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

    // Create post in our DB first
    const [post] = await db
      .insert(posts)
      .values({
        userId: user.id,
        content,
        mediaUrls,
        platforms,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        status: scheduledFor ? "scheduled" : "publishing",
      })
      .returning();

    try {
      // Create post via Zernio
      const zernioPost = await createZernioPost({
        content,
        platforms: accounts.map((a) => ({
          platform: a.platform,
          accountId: a.zernioAccountId || a.platform,
        })),
        scheduledFor: scheduledFor || undefined,
        publishNow: !scheduledFor,
        mediaIds: mediaUrls.length > 0 ? mediaUrls : undefined,
      });

      await db
        .update(posts)
        .set({
          zernioPostId: zernioPost._id,
          status: zernioPost.status === "published"
            ? "published"
            : scheduledFor
              ? "scheduled"
              : "publishing",
        })
        .where(eq(posts.id, post.id));

      return NextResponse.json({
        post: { ...post, zernioPostId: zernioPost._id, status: zernioPost.status },
      });
    } catch (zernioError) {
      // Update our post record with the failure
      const errorMsg = zernioError instanceof Error ? zernioError.message : "Zernio API error";
      console.error("Zernio createPost error:", zernioError);

      await db
        .update(posts)
        .set({ status: "failed", errorMessage: errorMsg })
        .where(eq(posts.id, post.id));

      return NextResponse.json(
        { error: `Post failed: ${errorMsg}` },
        { status: 502 }
      );
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    }
    console.error("Create post error:", e);
    const message = e instanceof Error ? e.message : "Failed to create post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
