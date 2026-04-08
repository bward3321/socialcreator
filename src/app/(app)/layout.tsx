import { redirect } from "next/navigation";
import { getCurrentUser, hasAccess, trialDaysLeft } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const daysLeft = trialDaysLeft(user);
  const active = hasAccess(user);
  const isExpired = user.subscriptionStatus === "expired";

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        email={user.email}
        daysLeft={daysLeft}
        subscriptionStatus={user.subscriptionStatus}
      />
      <main className="flex-1 ml-64">
        {isExpired && (
          <div className="bg-danger/10 border-b border-danger/20 px-6 py-3 text-center">
            <p className="text-sm text-danger font-medium">
              Your trial has expired.{" "}
              <a
                href="/settings/billing"
                className="underline hover:text-danger/80"
              >
                Upgrade to Pulsr Pro
              </a>{" "}
              to continue using all features.
            </p>
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
