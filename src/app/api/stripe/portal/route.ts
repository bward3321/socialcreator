import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createPortalSession } from "@/lib/stripe";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 });
  }

  try {
    const url = await createPortalSession(user.stripeCustomerId);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    console.error("Stripe portal error:", e);
    return NextResponse.json(
      { error: "Failed to create portal" },
      { status: 500 }
    );
  }
}
