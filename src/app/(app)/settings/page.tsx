import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { SignOutButton } from "./sign-out-button";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const statusLabel = {
    trialing: "Free Trial",
    active: "Pro",
    expired: "Expired",
    canceled: "Canceled",
  }[user.subscriptionStatus] || user.subscriptionStatus;

  const statusVariant = {
    trialing: "purple" as const,
    active: "success" as const,
    expired: "danger" as const,
    canceled: "danger" as const,
  }[user.subscriptionStatus] || ("default" as const);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500">
          Manage your account and subscription.
        </p>
      </div>

      <div className="space-y-6">
        {/* Email */}
        <Card>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">Email</h2>
          <p className="text-zinc-200">{user.email}</p>
        </Card>

        {/* Plan */}
        <Card>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">Plan</h2>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {user.subscriptionStatus === "trialing" && (
              <span className="text-xs text-zinc-500">
                Ends {format(new Date(user.trialEndsAt), "MMM d, yyyy")}
              </span>
            )}
          </div>
          <Link
            href="/settings/billing"
            className="text-sm text-purple hover:underline"
          >
            Manage billing →
          </Link>
        </Card>

        {/* Member since */}
        <Card>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">
            Member since
          </h2>
          <p className="text-zinc-200">
            {format(new Date(user.createdAt), "MMMM d, yyyy")}
          </p>
        </Card>

        {/* Sign out */}
        <Card>
          <SignOutButton />
        </Card>
      </div>
    </div>
  );
}
