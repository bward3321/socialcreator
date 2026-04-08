import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, lt, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Expire trialing users whose trial ended and have no Stripe subscription
    const result = await db
      .update(users)
      .set({ subscriptionStatus: "expired" })
      .where(
        and(
          eq(users.subscriptionStatus, "trialing"),
          lt(users.trialEndsAt, now),
          isNull(users.stripeSubscriptionId)
        )
      )
      .returning({ id: users.id });

    return NextResponse.json({ ok: true, expired: result.length });
  } catch (e) {
    console.error("Trial expire cron error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
