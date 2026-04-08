import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, and, gte, isNotNull } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, PenSquare } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, isToday, isTomorrow, startOfDay } from "date-fns";

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const scheduledPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.userId, user.id),
        eq(posts.status, "scheduled"),
        isNotNull(posts.scheduledFor),
        gte(posts.scheduledFor, new Date())
      )
    )
    .orderBy(posts.scheduledFor);

  // Group by day
  const grouped = new Map<string, typeof scheduledPosts>();
  for (const post of scheduledPosts) {
    const day = startOfDay(new Date(post.scheduledFor!)).toISOString();
    const existing = grouped.get(day) || [];
    existing.push(post);
    grouped.set(day, existing);
  }

  function dayLabel(iso: string) {
    const d = new Date(iso);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "EEEE, MMMM d");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Schedule</h1>
          <p className="text-sm text-zinc-500">
            Upcoming scheduled posts.
          </p>
        </div>
        <Link
          href="/compose"
          className="gradient-bg text-white font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 text-sm"
        >
          <PenSquare className="w-4 h-4" />
          Schedule a post
        </Link>
      </div>

      {scheduledPosts.length === 0 ? (
        <div className="text-center py-24">
          <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">
            Nothing scheduled
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            Schedule posts from the Compose page to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([day, dayPosts]) => (
            <div key={day}>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                {dayLabel(day)}
              </h2>
              <div className="space-y-3">
                {dayPosts.map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`}>
                    <Card className="hover:border-purple/30 transition-colors cursor-pointer mb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 line-clamp-2 mb-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <Clock className="w-3 h-3" />
                              {format(
                                new Date(post.scheduledFor!),
                                "h:mm a"
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {(post.platforms as string[]).map((p) => (
                                <Badge key={p} variant="purple">
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Badge variant="purple">Scheduled</Badge>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
