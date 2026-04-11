"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, CheckCircle2, Send, Info } from "lucide-react";

const PLATFORMS = [
  { id: "twitter", name: "Twitter / X", color: "#1DA1F2" },
  { id: "instagram", name: "Instagram", color: "#E4405F" },
  { id: "facebook", name: "Facebook", color: "#1877F2", hint: "Facebook may ask you to log in again for business page permissions." },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
  { id: "tiktok", name: "TikTok", color: "#ff0050" },
  { id: "youtube", name: "YouTube", color: "#FF0000" },
  { id: "pinterest", name: "Pinterest", color: "#E60023" },
  { id: "reddit", name: "Reddit", color: "#FF4500" },
  { id: "bluesky", name: "Bluesky", color: "#0085FF", hint: "Bluesky requires a separate login — this is normal (they use app passwords instead of OAuth)." },
  { id: "threads", name: "Threads", color: "#000000" },
];

type Account = {
  id: string;
  platform: string;
  platformUsername: string | null;
  platformDisplayName: string | null;
  followerCount: number;
};

export default function ConnectPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(false);
  const [requestPlatform, setRequestPlatform] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zernio/sync");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (e) {
      console.error("Failed to fetch accounts:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Listen for OAuth popup success
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth-success") {
        setJustConnected(true);
        fetchAccounts();
        setTimeout(() => setJustConnected(false), 3000);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchAccounts]);

  async function handleConnect(platform: string) {
    setConnecting(platform);
    try {
      const res = await fetch("/api/zernio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();
      if (data.authUrl) {
        // Open as centered popup instead of new tab
        const w = 600, h = 700;
        const left = Math.round((screen.width - w) / 2);
        const top = Math.round((screen.height - h) / 2);
        window.open(
          data.authUrl,
          "oauth-popup",
          `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
        );
      }
    } catch (e) {
      console.error("Failed to connect:", e);
    } finally {
      setConnecting(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    await fetchAccounts();
    setSyncing(false);
  }

  async function handlePlatformRequest() {
    if (!requestPlatform.trim()) return;
    setRequestSending(true);
    try {
      await fetch("/api/platform-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: requestPlatform.trim() }),
      });
      setRequestSent(true);
      setRequestPlatform("");
      setTimeout(() => setRequestSent(false), 5000);
    } catch {
      // Silently fail — best effort
    } finally {
      setRequestSending(false);
    }
  }

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Connect Accounts
          </h1>
          <p className="text-sm text-zinc-500">
            Link your social platforms to Pulsr.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleSync}
          loading={syncing}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Success toast */}
      {justConnected && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-accent/10 border border-accent/20 text-sm text-accent flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Account connected successfully!
        </div>
      )}

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Connected
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {accounts.map((account) => {
              const platform = PLATFORMS.find(
                (p) => p.id === account.platform
              );
              return (
                <Card key={account.id} className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: platform?.color || "#6B7280" }}
                  >
                    {account.platform.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200">
                      {platform?.name || account.platform}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      @{account.platformUsername || "connected"}
                    </p>
                  </div>
                  <Badge variant="success">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Available platforms */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        {accounts.length > 0 ? "Add more" : "Available platforms"}
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {PLATFORMS.filter((p) => !connectedPlatforms.has(p.id)).map(
          (platform) => (
            <Card
              key={platform.id}
              className="flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: platform.color }}
                  >
                    {platform.id.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">
                    {platform.name}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => handleConnect(platform.id)}
                  loading={connecting === platform.id}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Connect
                </Button>
              </div>
              {platform.hint && (
                <p className="flex items-start gap-1.5 mt-3 text-xs text-zinc-500">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {platform.hint}
                </p>
              )}
            </Card>
          )
        )}
      </div>

      {/* Request a platform */}
      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="text-lg font-semibold text-zinc-200 mb-2">
          Don&apos;t see your platform?
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Let us know which platform you&apos;d like to connect and we&apos;ll look into adding it.
        </p>
        <div className="flex items-center gap-3 max-w-md">
          <input
            type="text"
            placeholder="e.g. Substack, Mastodon..."
            value={requestPlatform}
            onChange={(e) => setRequestPlatform(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePlatformRequest()}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30"
          />
          <Button
            variant="secondary"
            onClick={handlePlatformRequest}
            loading={requestSending}
            disabled={!requestPlatform.trim()}
          >
            <Send className="w-3.5 h-3.5" />
            Request
          </Button>
        </div>
        {requestSent && (
          <p className="text-sm text-accent mt-2">Thanks! We&apos;ll look into it.</p>
        )}
      </div>
    </div>
  );
}
