# Step 0: Consolidated Dependency & Setup Audit

Per CLAUDE.md Step 0: one upfront list of everything to install/configure before any
admin-core code is written. The human runs this once. After this, no mid-build install
requests. Decisions locked: pilot = stryvia-chat, one `admin-core` repo, alerts via web
push + Twilio (high-severity).

---

## A. New cloud resources the human creates once

| Resource | Action |
|---|---|
| GitHub repo | Create private `ibraheemazar/admin-core`, then add it to this session's scope |
| Vercel project | `admin-core-hq` (HQ hub app), greynab team |
| Supabase project | New project for HQ: connection registry + cached rollups + HQ audit |
| Domain | `hq.stryvia.ai` -> Vercel HQ project |
| Twilio | Reuse existing Verify/Messaging; confirm a Messaging Service SID for alerts |
| Web push | Generate VAPID keypair (script provided) for PWA push |

No per-site Supabase changes. Each site keeps its own project; HQ reads via the registry.

## B. Packages (pnpm, in admin-core)

Runtime: `next@15` `react@19` `react-dom@19` `@supabase/supabase-js` `@supabase/ssr`
`@anthropic-ai/sdk` `zod` `swr` `@tanstack/react-table` `cmdk` (command palette)
`recharts` (charts) `web-push` (push) `nanoid` `date-fns` `tailwindcss@4`
`class-variance-authority` `lucide-react`.

Dev: `typescript` `@types/node` `@types/react` `eslint` `eslint-config-next`
`prettier` `vitest` `@playwright/test`.

Sites consuming the package add only `@stryvia/admin-core` (workspace or published).

## C. CLI tools (already standard across repos)

`node` (per Next 15) · `pnpm` · `supabase` CLI · `vercel` CLI · `git`. No new CLIs.

## D. Environment variables

HQ app (`admin-core-hq`):
```
# HQ's own Supabase
HQ_SUPABASE_URL, HQ_SUPABASE_ANON_KEY, HQ_SUPABASE_SERVICE_ROLE_KEY
# Encryption for the site-connection registry (per-site service keys at rest)
SITE_REGISTRY_ENCRYPTION_KEY          # 32-byte base64, pgsodium/Vault backed
# AI
ANTHROPIC_API_KEY
ANTHROPIC_RECO_MODEL=claude-opus-4-8
ANTHROPIC_CHAT_MODEL=claude-sonnet-4-6
# Push
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
# Alerts via existing Twilio
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID
ALERT_CHANNEL=push                     # push | push+twilio
```

Per-site connection record (stored encrypted in HQ registry, not in env): site slug,
Supabase URL, scoped service key (or a read-only role), Stripe account tag, enabled scopes.

Pilot site (stryvia-chat) adds: `@stryvia/admin-core` dep + `admin.config.ts` (no new
secrets; reuses its existing Supabase/Stripe/Anthropic env).

## E. Supabase (HQ project) schema to create in migrations

All RLS-on, admin-role gated:
- `properties` (site registry: slug, name, supabase_url, encrypted_service_key, stripe_tag, scopes, health)
- `rollups_daily` (cached per-site MRR, leads, churn, anomalies, keyed site+date, idempotent upsert)
- `alerts` (severity, source site, type, payload, state) + `alert_subscriptions`
- `audit_log` (immutable, trigger-based) + `admin_users` + `roles` + `role_permissions`
- `push_subscriptions` (per admin device)

Per-site: no schema change required for Phase 1. A read-only Postgres role per site is
recommended (human creates it) so HQ never holds a full service key.

## F. Dashboard setup the human does once

- Supabase (HQ): enable Auth (email + Google), apply migrations, enable pgsodium/Vault.
- Per site: create a read-only DB role for HQ; record its credentials into the registry.
- Google OAuth: add `https://<hq-ref>.supabase.co/auth/v1/callback` to the existing
  Stryvia OAuth client redirect URIs (per stryvia-chat CLAUDE.md procedure).
- Twilio: confirm Messaging Service SID; keep Verify as-is.
- Vercel: set the HQ env vars above; add `hq.stryvia.ai`.
- GitHub: create `admin-core`, add to session scope.

## G. What is NOT needed (explicitly)

No new AI vendor, no new payment processor, no central data warehouse, no Kafka/queue
service (pg_cron + job runner covers scheduling), no per-site Supabase migrations for
Phase 1.

---

When A and F are done, Phase 0 (lift the PR #34 scaffold into `admin-core`, define the
module interface + `admin.config.ts`, stand up the HQ skeleton + registry) can begin with
zero further install requests.
