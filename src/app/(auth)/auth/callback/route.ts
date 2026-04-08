import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLinkToken, upsertUser, createSession } from "@/lib/auth";
import { createProfile } from "@/lib/zernio/client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  const email = await consumeMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  const user = await upsertUser(email);

  // Create Zernio profile for new users
  if (!user.zernioProfileKey) {
    try {
      const profile = await createProfile(email);
      await db
        .update(users)
        .set({ zernioProfileKey: profile._id })
        .where(eq(users.id, user.id));
    } catch (e) {
      console.error("Failed to create Zernio profile:", e);
      // Non-blocking — user can still use the app
    }
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
