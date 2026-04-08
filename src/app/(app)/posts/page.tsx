import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, PenSquare } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";

export default async function PostsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, user.id))
    .orderBy(desc(posts.createdAt));

  const statusVariant = (status: string) => {
    switch (status) {
      case "published":
        return "success" as const;
      case "failed":
        return "danger" as const;
      case "scheduled":
        return "purple" as const;
      case "publishing":
        return "warning" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Posts</h1>
          <p className="text-sm text-zinc-500">
            All your posts across platforms.
          </p>
        </div>
        <Link
          href="/compose"
          className="gradient-bg text-white font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 text-sm"
        >
          <PenSquare className="w-4 h-4" />
          New post
        </Link>
      </div>

      {userPosts.length === 0 ? (
        <div className="text-center py-24">
          <FileText className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">
            No posts yet
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            Create your first post to see it here.
          </p>
          <Link
            href="/compose"
            className="gradient-bg text-white font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 text-sm"
          >
            <PenSquare className="w-4 h-4" />
            Compose
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {userPosts.map((post) => (
            <Link key={post.id} href={`/posts/${post.id}`}>
              <Card className="hover:border-purple/30 transition-colors cursor-pointer mb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 line-clamp-2 mb-2">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(post.platforms as string[]).map((p) => (
                        <Badge key={p} variant="purple">
                          {p}
                        </Badge>
                      ))}
                      <span className="text-xs text-zinc-600">
                        {format(new Date(post.createdAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                  </div>
                  <Badge variant={statusVariant(post.status)}>
                    {post.status}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
