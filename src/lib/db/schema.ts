import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  real,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  trialStartedAt: timestamp("trial_started_at").defaultNow().notNull(),
  trialEndsAt: timestamp("trial_ends_at").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("trialing").notNull(),
  day6ReminderSent: boolean("day6_reminder_sent").default(false).notNull(),
  zernioProfileKey: text("zernio_profile_key"),
});

export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const connectedAccounts = pgTable("connected_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  platform: text("platform").notNull(),
  zernioAccountId: text("zernio_account_id"),
  platformUsername: text("platform_username"),
  platformDisplayName: text("platform_display_name"),
  platformAvatarUrl: text("platform_avatar_url"),
  followerCount: integer("follower_count").default(0).notNull(),
  followingCount: integer("following_count").default(0).notNull(),
  totalPosts: integer("total_posts").default(0).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  mediaUrls: jsonb("media_urls").$type<string[]>().default([]).notNull(),
  platforms: jsonb("platforms").$type<string[]>().default([]).notNull(),
  scheduledFor: timestamp("scheduled_for"),
  status: text("status").default("draft").notNull(),
  zernioPostId: text("zernio_post_id"),
  platformPostIds: jsonb("platform_post_ids")
    .$type<Record<string, string>>()
    .default({})
    .notNull(),
  errorMessage: text("error_message"),
  syncedFromZernio: boolean("synced_from_zernio").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const postAnalytics = pgTable("post_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id),
  platform: text("platform").notNull(),
  likes: integer("likes").default(0).notNull(),
  comments: integer("comments").default(0).notNull(),
  shares: integer("shares").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  saves: integer("saves").default(0).notNull(),
  reach: integer("reach").default(0).notNull(),
  impressions: integer("impressions").default(0).notNull(),
  engagementRate: real("engagement_rate").default(0).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const accountAnalytics = pgTable("account_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectedAccountId: uuid("connected_account_id")
    .notNull()
    .references(() => connectedAccounts.id),
  followerCount: integer("follower_count").default(0).notNull(),
  followingCount: integer("following_count").default(0).notNull(),
  totalPosts: integer("total_posts").default(0).notNull(),
  profileViews: integer("profile_views"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostAnalytic = typeof postAnalytics.$inferSelect;
export type AccountAnalytic = typeof accountAnalytics.$inferSelect;
