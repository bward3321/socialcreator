# Pulsr — Claude Code Context

## What is this?
Pulsr is a SaaS creator analytics + scheduling tool. It aggregates social media stats into one dashboard and lets creators schedule cross-platform posts.

## Stack
- Next.js 15 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 with custom dark theme (bg: #0A0A0F, surface: #13131A, purple→pink gradient)
- Neon Postgres via Drizzle ORM (schema at `src/lib/db/schema.ts`)
- Stripe for billing ($29/mo, 7-day trial)
- Resend for transactional email (magic links, trial reminders)
- Zernio API for social media layer (client at `src/lib/zernio/client.ts`)
- Deployed on Vercel

## Architecture
- Route groups: `(marketing)` for public pages, `(auth)` for login/callback, `(app)` for authenticated pages
- Auth is magic-link only (no passwords, no OAuth) — see `src/lib/auth/index.ts`
- Session is an httpOnly cookie (`pulsr_session`), 30-day expiry
- `getCurrentUser()` is the main auth check — returns User or null
- `hasAccess(user)` checks trial active OR subscribed
- Sidebar shows trial countdown badge
- Expired users see paywall banner but can still access `/settings/billing`

## Key patterns
- Server components by default, `"use client"` only where needed (forms, interactive UI)
- API routes handle mutations; server components handle reads
- Zernio API uses Profile-Key header for per-user scoping
- Stripe webhook handles subscription lifecycle
- Three Vercel crons: hourly analytics sync, daily trial reminder (14:00 UTC), daily trial expiry (00:05 UTC)

## Multi-tenant safety (Zernio)
- **CRITICAL**: Zernio's `GET /v1/accounts` and `GET /v1/analytics` endpoints return ALL data across the entire org, not scoped per profile. Account objects do NOT carry a reliable `profileId` field.
- **Our `connected_accounts` DB table is the tenant boundary.** Each row maps a Zernio account ID to a Pulsr user ID. This is the ONLY source of truth for "which accounts belong to which user."
- `listAllAccounts()` in `client.ts` fetches ALL org accounts without filtering. Callers must use our DB to determine ownership.
- The sync route (`/api/zernio/sync`) reads the user's existing `connected_accounts` from the DB, fetches all Zernio accounts, and only updates accounts already owned by the user. Unclaimed accounts (not owned by any user) are assigned to the current user.
- The cron sync builds each user's account ID set from the DB, then filters Zernio analytics entries by those account IDs.
- All DB queries on `connected_accounts` and `posts` must include a `userId` filter. Never trust Zernio's response to be pre-scoped.

## Database
6 tables: users, magic_link_tokens, sessions, connected_accounts, posts, post_analytics, account_analytics. All use UUID primary keys. Schema defined with Drizzle in `src/lib/db/schema.ts`.

## Commands
- `npm run dev` — local dev (Turbopack)
- `npm run build` — production build
- `npm run db:push` — push schema to Neon
- `npm run db:studio` — Drizzle Studio
