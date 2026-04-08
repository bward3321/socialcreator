"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/login");
  }

  return (
    <Button variant="danger" onClick={handleSignOut}>
      <LogOut className="w-4 h-4" />
      Sign out
    </Button>
  );
}
