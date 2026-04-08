# Pulsr

**All your stats. One bold dashboard.**

Creator analytics + scheduling tool. Connect all your socials, track growth, and schedule posts from one bold dashboard.

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4
- **Database:** Neon Postgres + Drizzle ORM
- **Payments:** Stripe (Checkout + Customer Portal + Webhooks)
- **Email:** Resend (magic links + trial reminders)
- **Social APIs:** Zernio (cross-platform posting + analytics)
- **Deploy:** Vercel

## Deploy Guide

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Neon database

Go to [neon.tech](https://neon.tech), create a project, and copy the connection string.

### 3. Create a Resend account

Go to [resend.com](https://resend.com), verify a sending domain. Copy your API key.

### 4. Create Stripe products

In the [Stripe Dashboard](https://dashboard.stripe.com):
- Create a product called **"Pulsr Pro"** with a $29/month recurring price
- Copy the **Price ID** (starts with `price_`)
- Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 5. Generate a CRON_SECRET

```bash
openssl rand -hex 32
```

### 6. Configure environment

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_APP_URL` — your app URL (http://localhost:3000 for local dev)
- `DATABASE_URL` — Neon connection string
- `RESEND_API_KEY` — from Resend dashboard
- `EMAIL_FROM` — e.g. `Pulsr <hello@yourdomain.com>`
- `STRIPE_SECRET_KEY` — from Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` — from Stripe webhook setup (step 11)
- `STRIPE_PRICE_ID` — your $29/mo price ID
- `ZERNIO_API_KEY` — your Zernio API key
- `CRON_SECRET` — random string from step 5
- `AUTH_SECRET` — another random string for hashing

### 7. Push database schema

```bash
npm run db:push
```

### 8. Test locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 9. Deploy to Vercel

```bash
vercel link
vercel --prod
```

### 10. Set environment variables in Vercel

Go to your project's Settings → Environment Variables in the Vercel dashboard. Add all variables from `.env.local`. Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://pulsr.vercel.app`).

### 11. Configure Stripe webhook

In Stripe Dashboard → Developers → Webhooks:
- Add endpoint: `https://YOUR_DOMAIN/api/stripe/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET`

### 12. Redeploy

```bash
vercel --prod
```

### 13. Test end-to-end

1. Sign up with an email → receive magic link → land on dashboard
2. Connect a social account via /connect
3. Compose and post content via /compose
4. Check analytics on the dashboard
5. Upgrade via /settings/billing → complete Stripe Checkout
6. Verify subscription status updates

## Cron Jobs

Configured in `vercel.json`:

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/sync-analytics` | Every hour | Sync account + post analytics from Zernio |
| `/api/cron/trial-reminder` | Daily 14:00 UTC | Email users whose trial ends in ~24h |
| `/api/cron/trial-expire` | Daily 00:05 UTC | Mark expired trials |

## Project Structure

```
src/
├── app/
│   ├── (marketing)/       # Landing page
│   ├── (auth)/            # Login + magic link callback
│   ├── (app)/             # Authenticated app pages
│   │   ├── dashboard/
│   │   ├── posts/[id]/
│   │   ├── compose/
│   │   ├── schedule/
│   │   ├── connect/
│   │   └── settings/billing/
│   └── api/
│       ├── auth/          # send-link, sign-out
│       ├── zernio/        # connect, sync, webhook
│       ├── posts/         # create, delete
│       ├── stripe/        # checkout, portal, webhook
│       └── cron/          # sync-analytics, trial-reminder, trial-expire
├── components/
│   ├── sidebar.tsx
│   └── ui/               # Button, Card, Input, Badge
└── lib/
    ├── auth/             # Magic links, sessions, user helpers
    ├── db/               # Drizzle schema + client
    ├── email/            # Resend email templates
    ├── stripe/           # Stripe helpers
    ├── zernio/           # Zernio API client
    └── utils.ts
```
