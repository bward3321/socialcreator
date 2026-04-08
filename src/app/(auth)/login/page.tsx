"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>

        <h1 className="text-3xl font-extrabold gradient-text mb-2">Pulsr</h1>
        <p className="text-zinc-400 mb-8">
          Sign in with your email — no password needed.
        </p>

        {sent ? (
          <div className="rounded-xl border border-purple/20 bg-purple/5 p-6 text-center">
            <Mail className="w-10 h-10 text-purple mx-auto mb-3" />
            <h2 className="font-semibold text-zinc-100 mb-2">
              Check your email
            </h2>
            <p className="text-sm text-zinc-400">
              We sent a magic link to{" "}
              <span className="text-zinc-200 font-medium">{email}</span>.
              Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-400 mb-1.5"
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              <Mail className="w-4 h-4" />
              Send magic link
            </Button>
            <p className="text-xs text-zinc-600 text-center">
              Free 7-day trial. No credit card required.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
