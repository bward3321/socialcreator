"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, Calendar, Clock, ImagePlus, X } from "lucide-react";

type Account = {
  id: string;
  platform: string;
  platformUsername: string | null;
  platformDisplayName: string | null;
  zernioAccountId: string | null;
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

export default function ComposePage() {
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Media upload state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/zernio/sync")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {});
  }, []);

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileIsVideo = file.type.startsWith("video/");
    const fileIsImage = file.type.startsWith("image/");
    if (!fileIsImage && !fileIsVideo) {
      setError("Please select an image or video file");
      return;
    }
    const maxSize = fileIsVideo ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(fileIsVideo ? "Video must be under 500MB" : "Image must be under 25MB");
      return;
    }

    setMediaFile(file);
    setIsVideo(fileIsVideo);
    setMediaPreview(URL.createObjectURL(file));
    setUploadedUrl(null);
    setError("");
  }

  function removeMedia() {
    setMediaFile(null);
    setIsVideo(false);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setUploadedUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadMedia(): Promise<string | null> {
    if (!mediaFile) return null;
    if (uploadedUrl) return uploadedUrl;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", mediaFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setUploadedUrl(data.url);
      return data.url;
    } catch (e) {
      throw new Error(`Upload failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(scheduleMode: boolean) {
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      // Upload media first if a file is selected
      const mediaUrl = await uploadMedia();

      const res = await fetch("/api/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          platforms: selectedPlatforms,
          scheduledFor: scheduleMode && scheduledFor ? scheduledFor : null,
          mediaUrls: mediaUrl ? [mediaUrl] : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create post");
      }

      setSuccess(true);
      setContent("");
      setSelectedPlatforms([]);
      setScheduledFor("");
      removeMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const connectedPlatforms = [...new Set(accounts.map((a) => a.platform))];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Compose</h1>
        <p className="text-sm text-zinc-500">
          Write once, publish everywhere.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Editor */}
        <div className="space-y-6">
          {/* Content */}
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

          {/* Media upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Media (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,video/x-m4v"
              onChange={handleFileSelect}
              className="hidden"
            />
            {mediaPreview ? (
              <div className="relative inline-block">
                {isVideo ? (
                  <video
                    src={mediaPreview}
                    controls
                    className="max-h-48 rounded-lg border border-border"
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Upload preview"
                    className="max-h-48 rounded-lg border border-border"
                  />
                )}
                <button
                  onClick={removeMedia}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800 border border-border flex items-center justify-center hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-zinc-400" />
                </button>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <p className="text-xs text-white">Uploading...</p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border bg-surface text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                Add an image or video
              </button>
            )}
          </div>

          {/* Platform selector */}
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

          {/* Schedule */}
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

          {/* Actions */}
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && (
            <p className="text-sm text-accent">Post created successfully!</p>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={() => handleSubmit(false)}
              loading={loading}
              disabled={!content || selectedPlatforms.length === 0}
            >
              <Send className="w-4 h-4" />
              Post now
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSubmit(true)}
              loading={loading}
              disabled={
                !content || selectedPlatforms.length === 0 || !scheduledFor
              }
            >
              <Clock className="w-4 h-4" />
              Schedule
            </Button>
          </div>
        </div>

        {/* Right: Live previews */}
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

                return (
                  <Card key={platform}>
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
                      <div>
                        <p className="text-sm font-semibold text-zinc-200 capitalize">
                          {platform}
                        </p>
                        <p className="text-xs text-zinc-500">
                          @{account?.platformUsername || "you"}
                        </p>
                      </div>
                    </div>
                    {mediaPreview && (
                      isVideo ? (
                        <video
                          src={mediaPreview}
                          controls
                          className="w-full max-h-64 rounded-lg mb-3"
                        />
                      ) : (
                        <img
                          src={mediaPreview}
                          alt="Preview"
                          className="w-full max-h-64 object-cover rounded-lg mb-3"
                        />
                      )
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
