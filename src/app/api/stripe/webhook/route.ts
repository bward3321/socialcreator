import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e) {
    console.error("Stripe webhook signature error:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        await db
          .update(users)
          .set({
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: "active",
          })
          .where(eq(users.id, userId));
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.status === "active" ? "active" : sub.status === "canceled" ? "canceled" : sub.status;
      await db
        .update(users)
        .set({ subscriptionStatus: status })
        .where(eq(users.stripeCustomerId, sub.customer as string));
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db
        .update(users)
        .set({
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
        })
        .where(eq(users.stripeCustomerId, sub.customer as string));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
