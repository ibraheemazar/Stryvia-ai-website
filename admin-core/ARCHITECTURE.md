# Admin panel — inventory & reusable architecture

This document captures **everything that was in the Stryvia admin panel** (so the
knowledge isn't trapped in one repo) and the plan for turning it into a reusable
core (`admin-core`) shared across many websites.

## 1. Inventory of the original Stryvia panel

The panel is a single SPA mounted at `/supadmin`, gated by Supabase OTP + an email
allowlist. It contained three layers:

### A. The chassis (generic — now `admin-core`)
- **Auth** — Supabase email one-time-code login + `ADMIN_EMAIL_ALLOWLIST`,
  fail-closed; service-role used server-side after verification.
- **Shell** — header, tab nav, sign-out, user email.
- **Theme** — dark/light + accent picker (cookie-backed).
- **AI Copilot** — floating "ask anything" assistant on every screen, streaming
  Claude, grounded in analytics + leads + conversation summaries.
- **AdminChat** — reusable streamed-chat component.
- **Connectors** — SES (email), Twilio (SMS), WhatsApp Cloud API, Slack webhook,
  generic webhook. Each no-ops gracefully when its env vars are absent.
- **Integrations hub** — 30+ provider cards with connect/disconnect status.

### B. CRM (semi-generic — shared by funnel sites, shipped as the `crm` module)
- Conversations inbox (inbox = leads, all = every conversation).
- Insights cards: total, converted, conversion rate, active/scoped.
- Top problem categories, full-text transcript search, status + locale filters.
- Lead scoring (color-coded, "hottest first").
- Conversation detail drawer: metadata, summary, full transcript, lead fields
  (status pipeline new→contacted→closed→lost, notes), and on-demand **AI
  analysis** (intent, requests, objections, sentiment, outcome, next action).

### C. Marketing suite (Stryvia-specific — a future opt-in `marketing` module)
- **Command center**: KPI cards, funnel, daily trend, top categories, by-source.
- **Conversation intelligence** + **Unified Learnings** (corpus synthesis).
- **Content studio**: AI-generate ad/social/email/blog/landing/sms/whatsapp;
  content library with status workflow.
- **Audiences (segments)**: rule-based, live preview counts.
- **Email**: AI copywriter (3 subjects + body) + campaign sender (SES).
- **Broadcast**: one-off email/SMS/WhatsApp to a segment.
- **Automations**: trigger→actions engine, AI-built from plain English; runs
  logged; actions = send email/SMS/WhatsApp, Slack notify, set lead status.
- **Landing & A/B**: AI-generated variants, weighted assignment, results
  (views, conversions, uplift, confidence, winner).
- **Links**: UTM builder. **Performance**: GA4/Meta/Google Ads metrics.
- **Channels**: the integrations hub.
- **Insights/Analytics**: GA4 deep-dive (sessions, users, pages, acquisition,
  events, devices) + first-party funnel + analytics chat.

### Data model (Supabase, ~14 tables)
- Core CRM: `conversations`, `messages`, `leads`.
- Marketing: `marketing_integrations`, `marketing_segments`, `marketing_content`,
  `marketing_campaigns`, `marketing_automations`, `marketing_automation_runs`,
  `marketing_insights`, `marketing_learnings`.
- Experiments: `landing_pages`, `experiment_events`.
- Attribution columns on `conversations` (utm_*, referrer, landing_path) and
  `analysis` JSON; `phone` on `leads`.

### API routes (all gated by `verifyAdmin`)
`/api/admin/data`, `/conversation`, `/lead`, `/insights`, `/insights/ask`,
`/copilot`, and `/marketing/{,content,email,broadcast,segments,automations,
landing,advisor,learnings,integrations}`.

### External services
Supabase (data + auth), Anthropic Claude (all AI), GA4 + Search Console,
Amazon SES, Twilio, WhatsApp Cloud API, Slack, PostHog, Google Ads / Meta,
Vercel Cron.

### Core env vars
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL_ALLOWLIST`, `ANTHROPIC_API_KEY`
(+ per-connector: `SES_*`, `TWILIO_*`, `WHATSAPP_*`, `SLACK_WEBHOOK_URL`,
`GA4_*`, ad-platform tokens).

## 2. What becomes reusable vs. per-site

| Layer | Disposition |
| --- | --- |
| Chassis (A) | **Extracted to `admin-core` core.** Identical on every site. |
| CRM (B) | **`crm` module.** Enabled on sites that have a chat→lead funnel. |
| Marketing (C) | **`marketing` module (future).** Opt-in; heavy + opinionated. |
| Anything new | A new module per site (e.g. `orders`, `posts`, `bookings`). |

## 3. Module contract

A module is a self-contained slice with four parts:

1. **UI** — a nav `label` + a React `Component` that receives the admin `token`.
2. **API** — route handlers under `/api/admin/<id>/*`, each calling `verifyAdmin`.
3. **SQL** — `schema.sql` run against that site's Supabase project.
4. **Copilot context (optional)** — a server function returning facts to ground
   the AI copilot for that site.

See `src/modules/types.ts` for the interface and `src/modules/crm/` for a full
working example.

## 4. Migration plan (incremental)

1. **Scaffold the chassis + module system** ← _you are here_.
2. Port the **CRM module** UI from the original `AdminDashboard`/`ConversationDetail`.
3. Adopt `admin-core` in the next new website (smallest one first).
4. Optionally extract the **marketing suite** into a `marketing` module.
5. Backport: replace Stryvia's bespoke `/supadmin` with `admin-core` + modules so
   there's one codebase to maintain.
