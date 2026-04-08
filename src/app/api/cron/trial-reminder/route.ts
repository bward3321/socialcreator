import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { sendTrialReminderEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in30h = new Date(now.getTime() + 30 * 60 * 60 * 1000);

    // Users whose trial ends in 24-30h and haven't been reminded
    const trialingUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.subscriptionStatus, "trialing"),
          eq(users.day6ReminderSent, false),
          gte(users.trialEndsAt, in24h),
          lte(users.trialEndsAt, in30h)
        )
      );

    for (const user of trialingUsers) {
      try {
        await sendTrialReminderEmail(user.email);
        await db
          .update(users)
          .set({ day6ReminderSent: true })
          .where(eq(users.id, user.id));
      } catch (e) {
        console.error(`Failed to send reminder to ${user.email}:`, e);
      }
    }

    return NextResponse.json({ ok: true, sent: trialingUsers.length });
  } catch (e) {
    console.error("Trial reminder cron error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
