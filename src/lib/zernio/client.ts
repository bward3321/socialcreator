const BASE_URL = "https://zernio.com/api/v1";
const API_KEY = () => process.env.ZERNIO_API_KEY!;

type RequestOptions = {
  method?: string;
  body?: unknown;
};

async function zernioFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_KEY()}`,
    "Content-Type": "application/json",
  };

  console.log(`[Zernio] ${opts.method || "GET"} ${url}`);

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Zernio] ERROR ${res.status}: ${text}`);
    throw new Error(`Zernio API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  console.log(`[Zernio] Response:`, JSON.stringify(json).slice(0, 500));
  return json as T;
}

// --- Profiles ---

export type ZernioProfile = {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault: boolean;
};

export async function createProfile(
  name: string,
  description?: string
): Promise<ZernioProfile> {
  const data = await zernioFetch<{ profile: ZernioProfile }>("/profiles", {
    method: "POST",
    body: { name, description },
  });
  return data.profile;
}

export async function getProfile(profileId: string): Promise<ZernioProfile> {
  const data = await zernioFetch<{ profile: ZernioProfile }>(`/profiles/${profileId}`);
  return data.profile;
}

// --- Connect ---

export type ConnectResponse = {
  authUrl: string;
};

export async function generateConnectUrl(
  platform: string,
  profileId: string,
  redirectUrl?: string
): Promise<ConnectResponse> {
  const params = new URLSearchParams({ profileId });
  if (redirectUrl) params.set("redirect_url", redirectUrl);
  return zernioFetch<ConnectResponse>(`/connect/${platform}?${params}`);
}

// --- Accounts ---

export type ZernioAccount = {
  _id: string;
  platform: string;
  displayName: string;
  username?: string;
  profileId?: string | { _id: string; name: string };
  profileUrl?: string;
  profilePicture?: string;
  isActive?: boolean;
  metadata?: {
    profileData?: {
      followersCount?: number;
      fanCount?: number;
      fan_count?: number;
      subscriberCount?: number;
      subscriber_count?: number;
      connectionsCount?: number;
      connections_count?: number;
      bio?: string;
      extraData?: {
        followsCount?: number;
        mediaCount?: number;
        likes?: number;
      };
    };
  };
};

/**
 * Extract follower count from a Zernio account, handling platform-specific field names.
 * Facebook uses fan_count/fanCount, YouTube uses subscriberCount, etc.
 */
export function extractFollowerCount(acct: ZernioAccount): number {
  const pd = acct.metadata?.profileData;
  if (!pd) return 0;

  // Log raw data for debugging platform-specific fields
  console.log(
    `[Zernio:debug] Raw profileData for ${acct.platform} (${acct.displayName}):`,
    JSON.stringify(pd, null, 2)
  );

  // Try platform-specific fields first, then generic followersCount
  const candidates: number[] = [
    pd.followersCount ?? 0,
    pd.fanCount ?? 0,
    pd.fan_count ?? 0,
    pd.subscriberCount ?? 0,
    pd.subscriber_count ?? 0,
    pd.connectionsCount ?? 0,
    pd.connections_count ?? 0,
  ];

  // Return the first non-zero value, or 0 if all are zero
  return candidates.find((c) => c > 0) ?? 0;
}

/**
 * Fetch ALL accounts under the Zernio org API key.
 *
 * IMPORTANT: This returns accounts for ALL users in the org, not scoped to a
 * single profile. Tenant isolation is handled at the caller level using our
 * connected_accounts DB table as the source of truth for account ownership.
 */
export async function listAllAccounts(
  page = 1,
  limit = 100
): Promise<ZernioAccount[]> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const data = await zernioFetch<{ accounts: ZernioAccount[] }>(`/accounts?${params}`);

  // Diagnostic: log the shape of the first account so we can see what fields exist
  if (data.accounts.length > 0) {
    console.log(
      `[Zernio:debug] Account object keys:`,
      Object.keys(data.accounts[0])
    );
    console.log(
      `[Zernio:debug] First account shape:`,
      JSON.stringify(data.accounts[0], null, 2)
    );
  }

  console.log(`[Zernio] Fetched ${data.accounts.length} total org accounts`);
  return data.accounts;
}

export async function getFollowerStats(): Promise<
  { accountId: string; counts: { date: string; followers: number }[] }[]
> {
  const data = await zernioFetch<{
    stats: { accountId: string; counts: { date: string; followers: number }[] }[];
  }>("/accounts/follower-stats");
  return data.stats;
}

// --- Posts ---

export type ZernioPlatformTarget = {
  platform: string;
  accountId: string;
  customContent?: string;
};

export type ZernioMediaItem = {
  type: "image" | "video";
  url: string;
  mimeType: string;
  thumbnail?: string;
};

export type ZernioPostInput = {
  content?: string;
  platforms: ZernioPlatformTarget[];
  scheduledFor?: string; // ISO datetime
  timezone?: string;
  publishNow?: boolean;
  mediaItems?: ZernioMediaItem[];
};

export type ZernioPost = {
  _id: string;
  status: string;
  content: string;
  platforms: {
    platform: string;
    accountId: string;
    status: string;
    platformPostUrl?: string;
    platformPostId?: string;
  }[];
  scheduledFor?: string;
  publishedAt?: string;
  createdAt: string;
};

export async function createPost(input: ZernioPostInput): Promise<ZernioPost> {
  const data = await zernioFetch<{ post: ZernioPost }>("/posts", {
    method: "POST",
    body: input,
  });
  return data.post;
}

export async function getPost(postId: string): Promise<ZernioPost> {
  const data = await zernioFetch<{ post: ZernioPost }>(`/posts/${postId}`);
  return data.post;
}

export async function deletePost(postId: string): Promise<void> {
  await zernioFetch(`/posts/${postId}`, { method: "DELETE" });
}

export async function listPosts(
  opts: { status?: string; platform?: string; page?: number; limit?: number } = {}
): Promise<ZernioPost[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.platform) params.set("platform", opts.platform);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const data = await zernioFetch<{ posts: ZernioPost[] }>(`/posts?${params}`);
  return data.posts;
}

// --- Analytics ---

export type AnalyticsMetrics = {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  views: number;
  engagementRate: number;
  lastUpdated?: string;
};

export type AnalyticsPlatformEntry = {
  platform: string;
  status: string;
  accountId: string;
  accountUsername?: string;
  analytics: AnalyticsMetrics;
};

export type AnalyticsPostEntry = {
  _id: string;
  latePostId: string;
  content?: string;
  publishedAt?: string;
  scheduledFor?: string;
  status?: string;
  analytics: AnalyticsMetrics;
  platforms: AnalyticsPlatformEntry[];
  platform?: string;
  platformPostUrl?: string;
  isExternal?: boolean;
  profileId?: string;
  thumbnailUrl?: string | null;
  mediaType?: string;
  mediaItems?: unknown[];
};

export type AnalyticsOverview = {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  lastSync?: string;
  dataStaleness?: Record<string, unknown>;
};

export type AnalyticsResponse = {
  overview: AnalyticsOverview;
  posts: AnalyticsPostEntry[];
};

export async function getAnalytics(opts: {
  postId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}): Promise<AnalyticsResponse> {
  const params = new URLSearchParams();
  if (opts.postId) params.set("postId", opts.postId);
  if (opts.fromDate) params.set("fromDate", opts.fromDate);
  if (opts.toDate) params.set("toDate", opts.toDate);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  return zernioFetch<AnalyticsResponse>(`/analytics?${params}`);
}

// --- Media Upload ---

export type MediaUploadResponse = {
  uploadUrl: string;
  publicUrl: string;
};

export async function getMediaUploadUrl(): Promise<MediaUploadResponse> {
  return zernioFetch<MediaUploadResponse>("/media/get-media-presigned-url");
}

export async function uploadMediaToZernio(
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<string> {
  console.log(`[Zernio:upload] Requesting presigned URL for contentType=${contentType} size=${fileBuffer.byteLength}`);
  const { uploadUrl, publicUrl } = await getMediaUploadUrl();
  console.log(`[Zernio:upload] Got presigned URL. publicUrl=${publicUrl}`);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(fileBuffer),
  });

  console.log(`[Zernio:upload] PUT response status=${putRes.status}`);
  if (!putRes.ok) {
    const text = await putRes.text();
    console.error(`[Zernio:upload] PUT failed ${putRes.status}: ${text}`);
    throw new Error(`Media upload failed: ${putRes.status} ${text.slice(0, 200)}`);
  }

  console.log(`[Zernio:upload] Success: ${publicUrl}`);
  return publicUrl;
}

// --- Bluesky credential connect ---

export type BlueskyConnectResponse = {
  account?: ZernioAccount;
  success?: boolean;
  message?: string;
};

export async function connectBlueskyCredentials(
  profileId: string,
  identifier: string,
  appPassword: string
): Promise<BlueskyConnectResponse> {
  return zernioFetch<BlueskyConnectResponse>("/connect/connect-bluesky-credentials", {
    method: "POST",
    body: { profileId, identifier, appPassword },
  });
}

// --- Webhooks ---

export type WebhookPayload = {
  event: string;
  timestamp: number;
  data: {
    postId: string;
    status: string;
    platform: string;
    accountId: string;
    platformPostUrl?: string;
    error?: string;
  };
};

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return signature === `sha256=${expected}`;
}
