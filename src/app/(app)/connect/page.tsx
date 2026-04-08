"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, CheckCircle2 } from "lucide-react";

const PLATFORMS = [
  { id: "twitter", name: "Twitter / X", color: "#1DA1F2" },
  { id: "instagram", name: "Instagram", color: "#E4405F" },
  { id: "facebook", name: "Facebook", color: "#1877F2" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
  { id: "tiktok", name: "TikTok", color: "#ff0050" },
  { id: "youtube", name: "YouTube", color: "#FF0000" },
  { id: "pinterest", name: "Pinterest", color: "#E60023" },
  { id: "reddit", name: "Reddit", color: "#FF4500" },
  { id: "bluesky", name: "Bluesky", color: "#0085FF" },
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

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
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
  }

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
        window.open(data.authUrl, "_blank");
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
              className="flex items-center justify-between"
            >
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
            </Card>
          )
        )}
      </div>
    </div>
  );
}
