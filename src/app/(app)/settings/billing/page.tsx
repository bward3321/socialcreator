import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { success, canceled } = await searchParams;
  const isActive = user.subscriptionStatus === "active";
  const hasCustomer = !!user.stripeCustomerId;

  return (
    <div className="max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Settings
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Billing</h1>
        <p className="text-sm text-zinc-500">
          Manage your Pulsr Pro subscription.
        </p>
      </div>

      {success && (
        <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
          <p className="text-sm text-accent">
            You&apos;re now on Pulsr Pro! Enjoy unlimited access.
          </p>
        </div>
      )}

      {canceled && (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 mb-6">
          <p className="text-sm text-yellow-400">
            Checkout was canceled. No charges were made.
          </p>
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">
          Pulsr Pro
        </h2>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-4xl font-bold font-mono gradient-text">
            $29
          </span>
          <span className="text-zinc-500">/month</span>
        </div>
        <ul className="space-y-2 my-6 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            Unlimited connected accounts
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            Cross-platform posting & scheduling
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            Full analytics dashboard
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            Hourly analytics sync
          </li>
        </ul>

        {isActive ? (
          <div className="space-y-3">
            <Badge variant="success">Active subscription</Badge>
            <form action="/api/stripe/portal" method="POST">
              <button
                type="submit"
                className="block w-full text-center bg-surface border border-border text-zinc-200 font-semibold px-4 py-2.5 rounded-lg hover:bg-border/50 transition-colors text-sm cursor-pointer"
              >
                Manage subscription
              </button>
            </form>
          </div>
        ) : (
          <form action="/api/stripe/checkout" method="POST">
            <button
              type="submit"
              className="block w-full text-center gradient-bg text-white font-semibold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity text-sm cursor-pointer"
            >
              {hasCustomer ? "Resubscribe" : "Start subscription"}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
