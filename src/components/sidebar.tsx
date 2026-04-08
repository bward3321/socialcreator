"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  PenSquare,
  Calendar,
  Link2,
  Settings,
  Clock,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/compose", label: "Compose", icon: PenSquare },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/connect", label: "Connect", icon: Link2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  email,
  daysLeft,
  subscriptionStatus,
}: {
  email: string;
  daysLeft: number;
  subscriptionStatus: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-border bg-surface flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-6">
        <Link href="/dashboard" className="text-2xl font-extrabold gradient-text">
          Pulsr
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-purple/10 text-purple"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-bg"
              )}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Trial badge */}
      {subscriptionStatus === "trialing" && (
        <div className="mx-3 mb-3 rounded-xl bg-purple/5 border border-purple/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-purple" />
            <span className="text-xs font-semibold text-purple">FREE TRIAL</span>
          </div>
          <p className="text-sm font-bold text-zinc-200">
            {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
          </p>
          <Link
            href="/settings/billing"
            className="mt-2 block text-center text-xs font-semibold gradient-bg text-white rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
          >
            Upgrade
          </Link>
        </div>
      )}

      {subscriptionStatus === "active" && (
        <div className="mx-3 mb-3 rounded-xl bg-accent/5 border border-accent/20 p-4">
          <span className="text-xs font-semibold text-accent">PRO</span>
          <p className="text-xs text-zinc-500 mt-0.5">{email}</p>
        </div>
      )}

      {subscriptionStatus === "expired" && (
        <div className="mx-3 mb-3 rounded-xl bg-danger/5 border border-danger/20 p-4">
          <span className="text-xs font-semibold text-danger">TRIAL EXPIRED</span>
          <Link
            href="/settings/billing"
            className="mt-2 block text-center text-xs font-semibold bg-danger text-white rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
          >
            Upgrade now
          </Link>
        </div>
      )}

      {/* User */}
      <div className="px-6 py-4 border-t border-border">
        <p className="text-xs text-zinc-500 truncate">{email}</p>
      </div>
    </aside>
  );
}
