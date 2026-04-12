"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, Calendar, Clock, ImagePlus, X, AlertCircle, Layers } from "lucide-react";

type Account = {
  id: string;
  platform: string;
  platformUsername: string | null;
  platformDisplayName: string | null;
  zernioAccountId: string | null;
};

type MediaItem = {
  file: File;
  previewUrl: string;
  isVideo: boolean;
  uploadedUrl: string | null;
};

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

const platformLimits: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  reddit: 40000,
  bluesky: 300,
  threads: 500,
};

// Max media items per post, per platform
const platformMediaMax: Record<string, number> = {
  twitter: 4,
  instagram: 10,
  facebook: 10,
  linkedin: 9,
  tiktok: 1,
  youtube: 1,
  pinterest: 1,
  reddit: 1,
  bluesky: 4,
  threads: 10,
};

// Platforms that REQUIRE media
const platformRequiresMedia: Record<string, "any" | "video" | null> = {
  instagram: "any",
  tiktok: "video",
  youtube: "video",
  pinterest: "any",
  twitter: null,
  facebook: null,
  linkedin: null,
  bluesky: null,
  threads: null,
  reddit: null,
};

export default function ComposePage() {
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/zernio/sync")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {});
  }, []);

  // Derived limits from selected platforms
  const mediaLimit = selectedPlatforms.length
    ? Math.min(...selectedPlatforms.map((p) => platformMediaMax[p] ?? 10))
    : 10;
  const limitingPlatform = selectedPlatforms
    .slice()
    .sort((a, b) => (platformMediaMax[a] ?? 10) - (platformMediaMax[b] ?? 10))[0];

  const hasVideo = mediaItems.some((m) => m.isVideo);
  const hasImage = mediaItems.some((m) => !m.isVideo);
  const hasAnyMedia = mediaItems.length > 0;

  // Pre-flight: platforms that will be rejected
  const blockedPlatforms = selectedPlatforms.filter((p) => {
    const req = platformRequiresMedia[p];
    if (!req) return false;
    if (req === "any" && !hasAnyMedia) return true;
    if (req === "video" && !hasVideo) return true;
    return false;
  });
  const postablePlatforms = selectedPlatforms.filter(
    (p) => !blockedPlatforms.includes(p)
  );

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const newItems: MediaItem[] = [];
    for (const file of files) {
      const fileIsVideo = file.type.startsWith("video/");
      const fileIsImage = file.type.startsWith("image/");
      if (!fileIsImage && !fileIsVideo) {
        setError(`Unsupported file type: ${file.name}`);
        continue;
      }
      const maxSize = fileIsVideo ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(
          `${file.name} too large (${fileIsVideo ? "max 500MB" : "max 25MB"})`
        );
        continue;
      }
      newItems.push({
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo: fileIsVideo,
        uploadedUrl: null,
      });
    }

    setMediaItems((prev) => {
      const combined = [...prev, ...newItems];
      if (combined.length > mediaLimit) {
        setError(`Max ${mediaLimit} media items for selected platforms`);
        return combined.slice(0, mediaLimit);
      }
      setError("");
      return combined;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeMedia(idx: number) {
    setMediaItems((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].previewUrl);
      next.splice(idx, 1);
      return next;
    });
  }

  function resetMedia() {
    mediaItems.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    setMediaItems([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadAll(): Promise<
    { type: "image" | "video"; url: string; mimeType: string }[]
  > {
    if (mediaItems.length === 0) return [];
    setUploading(true);
    try {
      const results = await Promise.all(
        mediaItems.map(async (m) => {
          if (m.uploadedUrl) {
            return {
              type: m.isVideo ? "video" as const : "image" as const,
              url: m.uploadedUrl,
              mimeType: m.file.type,
            };
          }
          const fd = new FormData();
          fd.append("file", m.file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          console.log(`[compose] Uploaded ${m.file.name} -> ${data.url}`);
          return {
            type: data.type as "image" | "video",
            url: data.url as string,
            mimeType: data.mimeType as string,
          };
        })
      );
      return results;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(scheduleMode: boolean) {
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      if (postablePlatforms.length === 0) {
        throw new Error(
          "No platforms can receive this post. Attach required media."
        );
      }

      const media = await uploadAll();
      console.log(`[compose] submit platforms=${postablePlatforms.join(",")} media=${media.length}`);

      const res = await fetch("/api/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          platforms: postablePlatforms,
          scheduledFor: scheduleMode && scheduledFor ? scheduledFor : null,
          media,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create post");

      setSuccess(true);
      setContent("");
      setSelectedPlatforms([]);
      setScheduledFor("");
      resetMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const connectedPlatforms = [...new Set(accounts.map((a) => a.platform))];
  const canAddMore = mediaItems.length < mediaLimit;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Compose</h1>
        <p className="text-sm text-zinc-500">
          Write once, publish everywhere.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Content
            </label>
            <textarea
              className="w-full h-48 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30 transition-colors resize-none"
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs text-zinc-600 mt-1">
              {content.length} characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Media (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,video/x-m4v"
              onChange={handleFileSelect}
              className="hidden"
            />

            {mediaItems.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {mediaItems.map((m, i) => (
                  <div key={i} className="relative">
                    {m.isVideo ? (
                      <video
                        src={m.previewUrl}
                        className="w-24 h-24 object-cover rounded-lg border border-border"
                      />
                    ) : (
                      <img
                        src={m.previewUrl}
                        alt={`Media ${i + 1}`}
                        className="w-24 h-24 object-cover rounded-lg border border-border"
                      />
                    )}
                    <button
                      onClick={() => removeMedia(i)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800 border border-border flex items-center justify-center hover:bg-zinc-700 transition-colors"
                      aria-label={`Remove ${m.file.name}`}
                    >
                      <X className="w-3.5 h-3.5 text-zinc-400" />
                    </button>
                    {uploading && !m.uploadedUrl && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <p className="text-[10px] text-white">Uploading...</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canAddMore && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border bg-surface text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                {mediaItems.length === 0 ? "Add images or a video" : "Add more"}
              </button>
            )}

            {selectedPlatforms.length > 0 && (
              <p className="text-xs text-zinc-600 mt-2">
                {mediaItems.length}/{mediaLimit} media
                {limitingPlatform && mediaLimit < 10 ? (
                  <> — limited by <span className="capitalize">{limitingPlatform}</span></>
                ) : null}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Platforms
            </label>
            {connectedPlatforms.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No accounts connected.{" "}
                <a href="/connect" className="text-purple hover:underline">
                  Connect one
                </a>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {connectedPlatforms.map((platform) => {
                  const selected = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                        selected
                          ? "border-purple/40 bg-purple/10 text-purple"
                          : "border-border bg-surface text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            platformColors[platform] || "#6B7280",
                        }}
                      />
                      <span className="capitalize">{platform}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {blockedPlatforms.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium capitalize">
                  {blockedPlatforms.join(", ")} require
                  {blockedPlatforms.some(
                    (p) => platformRequiresMedia[p] === "video"
                  )
                    ? " video"
                    : " media"}
                  .
                </p>
                {postablePlatforms.length > 0 ? (
                  <p className="text-amber-300/80">
                    Will post to {postablePlatforms.join(", ")} only.
                  </p>
                ) : (
                  <p className="text-amber-300/80">
                    Attach {blockedPlatforms.some((p) => platformRequiresMedia[p] === "video") ? "a video" : "an image or video"} to post.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Schedule (optional)
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {success && (
            <p className="text-sm text-accent">Post created successfully!</p>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={() => handleSubmit(false)}
              loading={loading || uploading}
              disabled={
                !content ||
                selectedPlatforms.length === 0 ||
                postablePlatforms.length === 0
              }
            >
              <Send className="w-4 h-4" />
              Post now
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSubmit(true)}
              loading={loading || uploading}
              disabled={
                !content ||
                selectedPlatforms.length === 0 ||
                postablePlatforms.length === 0 ||
                !scheduledFor
              }
            >
              <Clock className="w-4 h-4" />
              Schedule
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">
            Live Preview
          </h3>
          <div className="space-y-4">
            {selectedPlatforms.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-sm text-zinc-600">
                  Select platforms to see previews
                </p>
              </Card>
            ) : (
              selectedPlatforms.map((platform) => {
                const limit = platformLimits[platform] || 5000;
                const overLimit = content.length > limit;
                const account = accounts.find(
                  (a) => a.platform === platform
                );
                const first = mediaItems[0];
                const isCarousel = mediaItems.length > 1;
                const willSkip = blockedPlatforms.includes(platform);

                return (
                  <Card key={platform} className={willSkip ? "opacity-50" : ""}>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{
                          backgroundColor:
                            platformColors[platform] || "#6B7280",
                        }}
                      >
                        {platform.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-200 capitalize">
                          {platform}
                        </p>
                        <p className="text-xs text-zinc-500">
                          @{account?.platformUsername || "you"}
                        </p>
                      </div>
                      {willSkip && (
                        <span className="text-[10px] text-amber-300 uppercase tracking-wider">
                          Skipped
                        </span>
                      )}
                    </div>
                    {first && (
                      <div className="relative mb-3">
                        {first.isVideo ? (
                          <video
                            src={first.previewUrl}
                            controls
                            className="w-full max-h-64 rounded-lg"
                          />
                        ) : (
                          <img
                            src={first.previewUrl}
                            alt="Preview"
                            className="w-full max-h-64 object-cover rounded-lg"
                          />
                        )}
                        {isCarousel && (
                          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-[10px] text-white">
                            <Layers className="w-3 h-3" />
                            1/{mediaItems.length}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                      {content || (
                        <span className="text-zinc-600 italic">
                          Start typing...
                        </span>
                      )}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <p
                        className={`text-xs font-mono ${overLimit ? "text-danger" : "text-zinc-600"}`}
                      >
                        {content.length}/{limit}
                      </p>
                      {overLimit && (
                        <p className="text-xs text-danger">Over limit</p>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
