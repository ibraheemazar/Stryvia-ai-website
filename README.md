# stryvia.ai

The intelligence you build with. A trilingual-ready (English + Arabic now,
French-ready), dark-first marketing site whose spine is a live, streaming Chat
running on Anthropic `claude-opus-4-8`.

Built to the five Stryvia documents, with **Decisions and Additions** as the top
authority. Design follows Build Package **Part A** (the intelligent instrument:
near-black canvas, white type, a single acid-green `#c0fa20` live signal, the
focus-bracket device, calm focus-pull motion).

## Stack

- **Next.js (App Router) + TypeScript + React 19**
- **Tailwind CSS v4** with the Part A tokens as the theme (`src/styles/globals.css`)
- **next-intl** — locales `en`, `ar` (full RTL via logical CSS properties); add
  `fr` by appending to `src/i18n/routing.ts` and adding `messages/fr*.json`
- **Anthropic SDK** — server-side streaming Chat (`src/app/api/chat`)
- **Supabase** — conversations, leads, admin auth
- **PostHog** — behavioural analytics + masked session replay (consent-gated)
- Deploys on **Vercel**

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Fonts (Bricolage Grotesque, Hanken Grotesk, JetBrains Mono, IBM Plex Sans
Arabic) are self-hosted via `next/font` and download at build time.

## Environment

See `.env.example`. The site runs without any of these — the Chat shows a
"not connected" state, persistence and analytics no-op — so you can develop the
UI before wiring services. To go live, provide:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | The Chat engine (server-only). Model pinned to `claude-opus-4-8`. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client + admin auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side conversation/lead writes and admin reads |
| `ADMIN_EMAIL_ALLOWLIST` | Comma-separated emails allowed into `/admin` |
| `LEAD_NOTIFY_TO` / `LEAD_NOTIFY_FROM` / `RESEND_API_KEY` | Immediate converted-lead email |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Analytics (consent-gated) |
| `NEXT_PUBLIC_SITE_URL` | Metadata, hreflang, sitemap |
| `NEXT_PUBLIC_DATA_REGION` / `NEXT_PUBLIC_DATA_IN_KINGDOM` | **Data residency truth** (see below) |

### Data residency (Decisions §7) — read before launch

The Trust and Privacy pages must not promise more than the infrastructure
delivers. Set `NEXT_PUBLIC_DATA_IN_KINGDOM=true` **only** if the Supabase and
Vercel regions you selected are inside the Kingdom. If the nearest available
region is outside, leave it `false` and the copy automatically softens to the
honest "nearest available region, in-Kingdom as the platform grows" wording.
Set `NEXT_PUBLIC_DATA_REGION` to the human label of the region you chose.

## Database

Apply the schema in `supabase/migrations/0001_init.sql` (conversations,
messages with full-text search, leads; RLS on, writes via service role). Via the
Supabase SQL editor or the CLI:

```bash
supabase db push   # or paste the migration into the SQL editor
```

## The admin dashboard

`/admin` — locale-agnostic, noindex. Sign in by magic link (Supabase Auth);
only emails in `ADMIN_EMAIL_ALLOWLIST` can read data. Shows Insights, the Inbox
of converted leads, all conversations (searchable, filterable), and a detail
drawer with the full transcript and editable lead status + notes.

## Scripts

```bash
npm run dev        # develop
npm run build      # production build (runs lint + type-check)
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

## Project shape

```
src/
  app/[locale]/        localized pages (home + Tier 1 set)
  app/admin/           admin SPA (separate root layout)
  app/api/             chat (streaming), lead, early-access, admin/*
  components/          ui · chat · layout · home · content · interactive · …
  i18n/                next-intl routing, navigation, request config
  lib/                 anthropic · supabase · chat (prompt/store/summarize) · …
  messages/            en/ar core + .pages + .content catalogs
  styles/globals.css   Part A design system (the law)
supabase/migrations/   schema
```
