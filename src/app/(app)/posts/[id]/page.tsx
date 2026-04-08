import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts, postAnalytics } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { ArrowLeft, Eye, Heart, MessageCircle, Share2, Bookmark, Users } from "lucide-react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.userId, user.id)))
    .limit(1);

  if (!post) notFound();

  const analytics = await db
    .select()
    .from(postAnalytics)
    .where(eq(postAnalytics.postId, post.id))
    .orderBy(desc(postAnalytics.fetchedAt));

  // Deduplicate by platform (latest only)
  const latestByPlatform = new Map<string, typeof analytics[0]>();
  for (const a of analytics) {
    if (!latestByPlatform.has(a.platform)) {
      latestByPlatform.set(a.platform, a);
    }
  }
  const platformAnalytics = Array.from(latestByPlatform.values());

  const statusVariant = (status: string) => {
    switch (status) {
      case "published": return "success" as const;
      case "failed": return "danger" as const;
      case "scheduled": return "purple" as const;
      default: return "default" as const;
    }
  };

  return (
    <div>
      <Link
        href="/posts"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All posts
      </Link>

      <Card className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {(post.platforms as string[]).map((p) => (
              <Badge key={p} variant="purple">{p}</Badge>
            ))}
          </div>
          <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
        </div>
        <p className="text-zinc-200 whitespace-pre-wrap mb-4">{post.content}</p>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Created {format(new Date(post.createdAt), "MMM d, yyyy h:mm a")}</span>
          {post.scheduledFor && (
            <span>Scheduled for {format(new Date(post.scheduledFor), "MMM d, yyyy h:mm a")}</span>
          )}
        </div>
        {post.errorMessage && (
          <p className="mt-3 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {post.errorMessage}
          </p>
        )}
      </Card>

      {/* Analytics breakdown */}
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">
        Per-Platform Analytics
      </h2>

      {platformAnalytics.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-sm text-zinc-600">
            No analytics data yet. Data syncs hourly after publishing.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {platformAnalytics.map((a) => (
            <Card key={a.platform}>
              <h3 className="text-sm font-semibold text-zinc-200 capitalize mb-4">
                {a.platform}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <Metric icon={Eye} label="Views" value={a.views} />
                <Metric icon={Heart} label="Likes" value={a.likes} />
                <Metric icon={MessageCircle} label="Comments" value={a.comments} />
                <Metric icon={Share2} label="Shares" value={a.shares} />
                <Metric icon={Bookmark} label="Saves" value={a.saves} />
                <Metric icon={Users} label="Reach" value={a.reach} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-lg font-bold font-mono text-zinc-200">
        {formatNumber(value)}
      </p>
    </div>
  );
}
