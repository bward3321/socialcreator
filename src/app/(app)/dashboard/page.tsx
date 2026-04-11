import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { connectedAccounts, posts, postAnalytics } from "@/lib/db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Users,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateRangeSelector } from "./date-range-selector";

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

const METRIC_DESCRIPTIONS: Record<string, string> = {
  Views: "Sum of TikTok views, Instagram plays, YouTube views, Twitter/X impressions, LinkedIn impressions",
  Likes: "Sum of likes across all connected platforms",
  Comments: "Sum of comments and replies across all connected platforms",
  Shares: "Sum of shares, retweets, and reposts across all connected platforms",
};

// Each platform's "top metric" label for the per-platform breakdown
const platformTopMetric: Record<string, string> = {
  tiktok: "views",
  youtube: "views",
  instagram: "likes",
  twitter: "impressions",
  linkedin: "impressions",
  facebook: "reach",
  pinterest: "saves",
  reddit: "comments",
  bluesky: "likes",
  threads: "likes",
};

type Props = {
  searchParams: Promise<{ range?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const range = params.range || "30";
  const days = range === "all" ? null : parseInt(range, 10) || 30;

  const accounts = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, user.id));

  const totalFollowers = accounts.reduce(
    (sum, a) => sum + a.followerCount,
    0
  );

  // Fetch posts within date range
  const postQuery = db
    .select()
    .from(posts)
    .where(
      days
        ? and(
            eq(posts.userId, user.id),
            gte(posts.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
          )
        : eq(posts.userId, user.id)
    )
    .orderBy(desc(posts.createdAt))
    .limit(100);

  const userPosts = await postQuery;
  const postIds = userPosts.map((p) => p.id);

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;

  // Per-platform analytics aggregation
  const platformStats: Record<string, { views: number; likes: number; comments: number; shares: number; impressions: number; reach: number; saves: number; postCount: number }> = {};

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

    // Per-platform breakdown
    const platAgg = await db
      .select({
        platform: postAnalytics.platform,
        views: sql<number>`COALESCE(SUM(${postAnalytics.views}), 0)`,
        likes: sql<number>`COALESCE(SUM(${postAnalytics.likes}), 0)`,
        comments: sql<number>`COALESCE(SUM(${postAnalytics.comments}), 0)`,
        shares: sql<number>`COALESCE(SUM(${postAnalytics.shares}), 0)`,
        impressions: sql<number>`COALESCE(SUM(${postAnalytics.impressions}), 0)`,
        reach: sql<number>`COALESCE(SUM(${postAnalytics.reach}), 0)`,
        saves: sql<number>`COALESCE(SUM(${postAnalytics.saves}), 0)`,
        postCount: sql<number>`COUNT(DISTINCT ${postAnalytics.postId})`,
      })
      .from(postAnalytics)
      .where(sql`${postAnalytics.postId} IN ${postIds}`)
      .groupBy(postAnalytics.platform);

    for (const row of platAgg) {
      platformStats[row.platform] = {
        views: Number(row.views),
        likes: Number(row.likes),
        comments: Number(row.comments),
        shares: Number(row.shares),
        impressions: Number(row.impressions),
        reach: Number(row.reach),
        saves: Number(row.saves),
        postCount: Number(row.postCount),
      };
    }
  }

  const isEmpty = accounts.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            Your creator analytics at a glance.
          </p>
        </div>
        {!isEmpty && <DateRangeSelector current={range} />}
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
              tooltip={METRIC_DESCRIPTIONS.Views}
            />
            <StatCard
              icon={Heart}
              label="Likes"
              value={totalLikes}
              tooltip={METRIC_DESCRIPTIONS.Likes}
            />
            <StatCard
              icon={MessageCircle}
              label="Comments"
              value={totalComments}
              tooltip={METRIC_DESCRIPTIONS.Comments}
            />
            <StatCard
              icon={Share2}
              label="Shares"
              value={totalShares}
              tooltip={METRIC_DESCRIPTIONS.Shares}
            />
          </div>

          {/* Per-platform grid */}
          <h2 className="text-lg font-semibold text-zinc-200 mb-4">
            Connected Platforms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {accounts.map((account) => {
              const stats = platformStats[account.platform];
              const topMetricKey = platformTopMetric[account.platform] || "views";
              const topMetricValue = stats
                ? stats[topMetricKey as keyof typeof stats] ?? 0
                : 0;

              return (
                <Card key={account.id}>
                  <div className="flex items-center gap-4">
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
                      {account.followerCount > 0 ? (
                        <>
                          <p className="text-lg font-bold font-mono text-zinc-100">
                            {formatNumber(account.followerCount)}
                          </p>
                          <p className="text-xs text-zinc-500">followers</p>
                        </>
                      ) : (
                        <Badge variant="success">Connected</Badge>
                      )}
                    </div>
                  </div>
                  {stats && stats.postCount > 0 && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-zinc-500">
                      <span>{stats.postCount} posts synced</span>
                      <span className="capitalize">
                        {formatNumber(Number(topMetricValue))} {topMetricKey}
                      </span>
                    </div>
                  )}
                </Card>
              );
            })}
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
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tooltip?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-purple" />
        </div>
        <span className="text-sm text-zinc-500">{label}</span>
        {tooltip && (
          <span className="group relative ml-auto">
            <span className="w-4 h-4 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] text-zinc-500 cursor-help">
              i
            </span>
            <span className="absolute bottom-full right-0 mb-2 w-64 p-2 rounded-lg bg-zinc-800 border border-border text-xs text-zinc-300 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10">
              {tooltip}
            </span>
          </span>
        )}
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
