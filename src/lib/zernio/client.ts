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
      bio?: string;
      extraData?: {
        followsCount?: number;
        mediaCount?: number;
      };
    };
  };
};

function getProfileId(acct: ZernioAccount): string | undefined {
  if (!acct.profileId) return undefined;
  if (typeof acct.profileId === "string") return acct.profileId;
  return acct.profileId._id;
}

export async function listAccounts(
  filterProfileId?: string,
  page = 1,
  limit = 100
): Promise<ZernioAccount[]> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const data = await zernioFetch<{ accounts: ZernioAccount[] }>(`/accounts?${params}`);
  if (filterProfileId) {
    return data.accounts.filter(
      (acct) => getProfileId(acct) === filterProfileId
    );
  }
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

export type ZernioPostInput = {
  content?: string;
  platforms: ZernioPlatformTarget[];
  scheduledFor?: string; // ISO datetime
  timezone?: string;
  publishNow?: boolean;
  mediaIds?: string[];
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
