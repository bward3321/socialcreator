import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, sessions, magicLinkTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import type { User } from "@/lib/db/schema";

const SESSION_COOKIE = "pulsr_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMagicLinkToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await db.insert(magicLinkTokens).values({
    email: email.toLowerCase(),
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function consumeMagicLinkToken(
  token: string
): Promise<string | null> {
  const tokenHash = hashToken(token);

  const [row] = await db
    .select()
    .from(magicLinkTokens)
    .where(
      and(
        eq(magicLinkTokens.tokenHash, tokenHash),
        eq(magicLinkTokens.used, false),
        gt(magicLinkTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!row) return null;

  await db
    .update(magicLinkTokens)
    .set({ used: true })
    .where(eq(magicLinkTokens.id, row.id));

  return row.email;
}

export async function upsertUser(email: string): Promise<User> {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) return existing;

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [newUser] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      trialEndsAt,
    })
    .returning();

  return newUser;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return user || null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    cookieStore.delete(SESSION_COOKIE);
  }
}

export function isTrialActive(user: User): boolean {
  return (
    user.subscriptionStatus === "trialing" &&
    new Date(user.trialEndsAt) > new Date()
  );
}

export function isSubscribed(user: User): boolean {
  return user.subscriptionStatus === "active";
}

export function hasAccess(user: User): boolean {
  return isTrialActive(user) || isSubscribed(user);
}

export function trialDaysLeft(user: User): number {
  const diff = new Date(user.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
