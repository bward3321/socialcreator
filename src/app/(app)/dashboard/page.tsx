import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { connectedAccounts, posts, postAnalytics } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Users,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const platformColors: Record<string, string> = {
  twitter: "#1DA1F2",
  instagram: "#E4405F",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
  youtube: "#FF0000",
  pinterest: "#E60023",
  reddit: "#FF4500",
  bluesky: "#0085FF",
  threads: "#000000",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const accounts = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, user.id));

  const totalFollowers = accounts.reduce(
    (sum, a) => sum + a.followerCount,
    0
  );

  // Aggregate post analytics
  const userPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, user.id))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  const postIds = userPosts.map((p) => p.id);

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;

  if (postIds.length > 0) {
    const [agg] = await db
      .select({
        views: sql<number>`COALESCE(SUM(${postAnalytics.views}), 0)`,
        likes: sql<number>`COALESCE(SUM(${postAnalytics.likes}), 0)`,
        comments: sql<number>`COALESCE(SUM(${postAnalytics.comments}), 0)`,
        shares: sql<number>`COALESCE(SUM(${postAnalytics.shares}), 0)`,
      })
      .from(postAnalytics)
      .where(sql`${postAnalytics.postId} IN ${postIds}`);

    totalViews = Number(agg?.views || 0);
    totalLikes = Number(agg?.likes || 0);
    totalComments = Number(agg?.comments || 0);
    totalShares = Number(agg?.shares || 0);
  }

  const isEmpty = accounts.length === 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          Your creator analytics at a glance.
        </p>
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Hero number */}
          <div className="text-center mb-10">
            <p className="text-sm text-zinc-500 font-medium tracking-wider uppercase mb-3">
              Total Followers
            </p>
            <p className="text-[96px] sm:text-[120px] font-black font-mono gradient-text leading-none tracking-tight">
              {formatNumber(totalFollowers)}
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard
              icon={Eye}
              label="Views"
              value={totalViews}
            />
            <StatCard
              icon={Heart}
              label="Likes"
              value={totalLikes}
            />
            <StatCard
              icon={MessageCircle}
              label="Comments"
              value={totalComments}
            />
            <StatCard
              icon={Share2}
              label="Shares"
              value={totalShares}
            />
          </div>

          {/* Per-platform grid */}
          <h2 className="text-lg font-semibold text-zinc-200 mb-4">
            Connected Platforms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {accounts.map((account) => (
              <Card key={account.id} className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    backgroundColor:
                      platformColors[account.platform] || "#6B7280",
                  }}
                >
                  {account.platform.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 capitalize">
                    {account.platform}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    @{account.platformUsername || "connected"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold font-mono text-zinc-100">
                    {formatNumber(account.followerCount)}
                  </p>
                  <p className="text-xs text-zinc-500">followers</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Recent posts */}
          {userPosts.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-zinc-200 mb-4">
                Recent Posts
              </h2>
              <div className="space-y-3">
                {userPosts.slice(0, 5).map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`}>
                    <Card className="hover:border-purple/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 truncate">
                            {post.content.slice(0, 120)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {(post.platforms as string[]).map((p) => (
                              <Badge key={p} variant="purple">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <StatusBadge status={post.status} />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-purple" />
        </div>
        <span className="text-sm text-zinc-500">{label}</span>
      </div>
      <p className="text-3xl font-bold font-mono text-zinc-100">
        {formatNumber(value)}
      </p>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "published"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "scheduled"
          ? "purple"
          : "default";
  return <Badge variant={variant}>{status}</Badge>;
}

function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-border mb-6">
        <Users className="w-7 h-7 text-zinc-500" />
      </div>
      <h2 className="text-xl font-bold text-zinc-200 mb-2">
        No accounts connected
      </h2>
      <p className="text-zinc-500 mb-6 max-w-md mx-auto">
        Connect your social accounts to see your analytics here. It takes less
        than a minute.
      </p>
      <Link
        href="/connect"
        className="gradient-bg text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
      >
        <Link2 className="w-4 h-4" />
        Connect accounts
      </Link>
    </div>
  );
}
