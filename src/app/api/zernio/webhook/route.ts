import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, type WebhookPayload } from "@/lib/zernio/client";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-zernio-signature") || "";

  const webhookSecret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (webhookSecret && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload: WebhookPayload = JSON.parse(rawBody);

  if (payload.event === "post.published") {
    await db
      .update(posts)
      .set({
        status: "published",
        updatedAt: new Date(),
      })
      .where(eq(posts.zernioPostId, payload.data.postId));
  }

  if (payload.event === "post.failed") {
    await db
      .update(posts)
      .set({
        status: "failed",
        errorMessage: payload.data.error || "Post failed to publish",
        updatedAt: new Date(),
      })
      .where(eq(posts.zernioPostId, payload.data.postId));
  }

  return NextResponse.json({ received: true });
}
