import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deletePost as deleteZernioPost } from "@/lib/zernio/client";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) {
    return NextResponse.json({ error: "Post ID required" }, { status: 400 });
  }

  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, user.id)))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Delete from Zernio if it has a remote ID
  if (post.zernioPostId && user.zernioProfileKey) {
    try {
      await deleteZernioPost(post.zernioPostId);
    } catch (e) {
      console.error("Zernio delete error:", e);
    }
  }

  await db.delete(posts).where(eq(posts.id, postId));

  return NextResponse.json({ ok: true });
}
