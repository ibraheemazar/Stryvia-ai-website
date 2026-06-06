# Admin Core: Six-Way Comparison

Inventory of every admin/dashboard surface across the Stryvia estate, compiled to decide
what goes into a shared `admin-core` chassis, what stays a per-site module, and where the
sites conflict. This is a decision document. Nothing is built from it until you sign off on
the "what makes the cut" column.

Repos compared:

1. **stryvia-ai-website** (`/supadmin`) - marketing + leads command center
2. **cast-stryvia** (`/admin`) - casting marketplace operations + governance
3. **stryvia-rentals** (`/admin`) - equipment rental operations
4. **stryvia-chat** (`/dashboard` + `/admin`) - chatbot SaaS, customer + internal
5. **lebanese-actors-syndicate** (`/[locale]/admin`) - talent registry, privacy-first
6. **stryvia-performance** (`/admin` + `/clients`) - ads intelligence, internal only

---

## 1. At a glance

| | ai-website | cast | rentals | chat | LAS | performance |
|---|---|---|---|---|---|---|
| Admin root | `/supadmin` | `/admin` | `/admin` | `/admin` + `/dashboard` | `/[locale]/admin` | `/admin` + `/clients` |
| Pages | 2 surfaces, 11 sub-tabs | 14 | 30+ | 10 admin + 4 dashboard | 10 | ~18 |
| Next.js | 15.5 | 16.2 | 16.2 | 15.5 | 14.2 | 14.2 |
| Pkg mgr | npm | npm | pnpm | npm | pnpm | pnpm |
| Auth gate | email allowlist | RBAC + AAL2 OTP | workspace RBAC | `ADMIN_EMAILS` + RLS | role + field RLS | allowlist + AAL2 + RBAC |
| Multi-tenant | no | no | yes (workspace) | yes (client) | yes (tenant) | yes (client, read-all) |
| i18n / RTL | next-intl (admin excluded) | yes (ar/en) | no | no | next-intl, RTL default ar | no |
| Audit log | no | yes (immutable, trigger) | yes (booking + scan) | yes (basic) | yes (hardened) | yes |
| AI copilot | yes (streaming) | no | no | yes (streaming) | no | yes (Dr KPI chat) |
| Data access | service-role | service-role + RLS | RLS (org-scoped) | RLS + service-role | RLS (field-level) | RLS read / service write |
| Maturity | early, broad | mature governance | production core | moderate, analytics | lean, privacy | MVP complete |

Universal DNA: **every** site is Next.js App Router + Supabase (Postgres/Auth/RLS) +
Anthropic + "service-role for privileged writes." That common base is what makes a shared
chassis viable.

---

## 2. Feature-by-feature matrix

Legend: ✅ has it, strong · 🟡 partial/basic · ❌ absent · n/a not applicable to domain

| Capability | ai-web | cast | rentals | chat | LAS | perf | Verdict |
|---|---|---|---|---|---|---|---|
| **Auth + access control** | | | | | | | |
| Supabase auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **CHASSIS** |
| Email allowlist gate | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | CHASSIS (pluggable) |
| Role-based (RBAC) | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ | **CHASSIS (pluggable)** |
| Phone OTP / AAL2 MFA | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | CHASSIS (opt-in flag) |
| Field-level visibility RLS | ❌ | 🟡 | ❌ | ❌ | ✅ | ❌ | Module (LAS) |
| **Shell + UX** | | | | | | | |
| App shell (nav/header/theme) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **CHASSIS** |
| Theme picker / brand tokens | ✅ | 🟡 | 🟡 | ✅ | 🟡 | ✅ | CHASSIS |
| i18n + RTL | 🟡 | ✅ | ❌ | ❌ | ✅ | ❌ | CHASSIS (opt-in) |
| **Leads / CRM** | | | | | | | |
| Conversations inbox | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **Shared module** |
| Lead capture + scoring | ✅ | ❌ | 🟡 | ✅ | ❌ | ❌ | Shared module |
| Lead status/notes workflow | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | Shared module |
| **Marketing** | | | | | | | |
| Content studio (AI copy) | ✅ | ❌ | ❌ | ✅ | 🟡 | ❌ | Module |
| Segments / audiences | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Module |
| Email campaigns | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Module |
| Broadcast (SMS/WhatsApp) | ✅ | ❌ | ❌ | 🟡 | ❌ | ❌ | Module |
| Automations engine | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Module (ai-web only) |
| Landing pages + A/B | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Module (ai-web only) |
| Promo / coupon mgr | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Module |
| **Analytics** | | | | | | | |
| KPI dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **CHASSIS pattern** |
| Funnel analytics | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | Module |
| Cost/usage tracking | 🟡 | ❌ | ❌ | ✅ | ❌ | ✅ | Module |
| External analytics (GA4/GSC) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | Module |
| **AI copilot / chat** | ✅ | ❌ | 🟡 | ✅ | 🟡 | ✅ | **Shared module** |
| AI insights/recommendations | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | Shared module |
| **Domain operations** | | | | | | | |
| User/member management | 🟡 | ✅ | ✅ | 🟡 | ✅ | ✅ | **CHASSIS pattern** |
| Approval / review queue | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | Shared module |
| Content moderation / flags | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | Shared module |
| Verification workflow | ❌ | 🟡 | ❌ | ❌ | ✅ | ❌ | Module (LAS) |
| Inventory / fleet | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Module (rentals) |
| Bookings / scheduling | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | Module |
| Barcode scan in/out | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Module (rentals) |
| Bot/agent builder | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Module (chat) |
| AI enrichment pipeline | ❌ | 🟡 | ❌ | ✅ | ✅ | ❌ | Module |
| Ingestion + cron jobs | 🟡 | 🟡 | ✅ | ✅ | ❌ | ✅ | CHASSIS (job runner) |
| Connectors/integrations hub | ✅ | ❌ | ❌ | 🟡 | ❌ | ✅ | **Shared module** |
| Feature flags | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ | CHASSIS |
| **Governance** | | | | | | | |
| Immutable audit log | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ | **CHASSIS** |
| Platform health page | 🟡 | ✅ | ❌ | 🟡 | ❌ | ✅ | CHASSIS |
| CSV import/export | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | CHASSIS util |
| PDF report export | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | Module |
| **Billing** | | | | | | | |
| Stripe subscriptions | 🟡 | ✅ | ❌ | ✅ | ✅ | ❌ | **Shared module** |
| Offline/manual payment | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | Module (LAS) |

---

## 3. Overlaps (build once, reuse everywhere)

These appear in 3+ repos with near-identical intent. Strongest candidates for the shared
layer:

1. **App shell + auth gate + audit log.** All six rebuild a nav/header/theme shell, a
   Supabase session check, and (5 of 6) an audit trail. This is the chassis core. Cast and
   performance have the most complete audit (trigger-based, immutable); use cast's
   `audit_row_change()` trigger pattern as the reference implementation.

2. **Leads/conversations CRM.** ai-website and chat share an almost identical model
   (conversations -> messages -> leads, with hot/warm/cold scoring and a status/notes
   workflow). This is your "shared chat->lead funnel" from the plan. rentals has a lighter
   booking-request inbox that maps onto the same shape. **This is the single highest-value
   shared module.**

3. **AI copilot + insights.** ai-website, chat, and performance each built a streaming
   "ask your data" copilot plus a batch "generate insights/recommendations" job, all on
   Anthropic. Same two primitives every time: (a) streamed chat grounded in a data snapshot,
   (b) scheduled analysis that writes structured records. Extract both.

4. **Integrations/connectors hub.** ai-website (20+ connectors) and performance (module/
   connector registry) both model "external service + status + non-secret config + unlock
   criteria." chat has an implicit version. One registry-driven connectors module covers all.

5. **User/role management + allowlist.** cast, rentals, LAS, performance all ship an admin
   page to add users, set roles, and gate access. The data shapes differ (allowlist vs
   workspace_members vs user_roles) but the screen is the same.

6. **KPI dashboard pattern.** All six open on a metrics summary. Not one component, but one
   pattern (server-loaded aggregate + card grid + trend) worth standardizing.

---

## 4. Unique features (stay as per-site modules)

Genuinely domain-specific, no reuse case. These define each site and must remain pluggable
modules, never forced into the core:

- **rentals:** barcode scan in/out, NIIMBOT label printing, equipment units/SKUs/packages,
  damage inspection, fleet utilization.
- **cast:** talent database with visibility tiers, selftape request/submission review,
  shortlists, casting briefs, talent CSV import with embeddings.
- **chat:** bot/agent builder (persona, system prompt, guardrails, API keys, widget embed),
  pgvector RAG knowledge base, pilot/trial countdown, referral program.
- **LAS:** AI profile enrichment from public sources, one-tap WhatsApp approval, casting-
  director verification tiers, minor-guardian consent locks, trilingual news/in-memoriam.
- **performance:** Google Ads + GA4 ingestion, GAQL builders, anomaly detection,
  copy-ready optimization recommendations, locked write-access/CRM/offline-conversion flags.
- **ai-website:** marketing automations engine and landing-page A/B testing (currently the
  only site with these; promote to shared module only if a second site needs them).

---

## 5. Conflicts to resolve before building

These are real divergences. Each needs a decision from you, because picking wrong forces a
later rewrite. I have noted my recommendation but am not acting on it yet.

| # | Conflict | The split | Recommendation |
|---|---|---|---|
| C1 | **Auth model** | allowlist (ai-web, chat) vs full RBAC (cast, rentals, LAS, perf) vs mandatory AAL2 OTP (cast, perf) | Chassis ships a pluggable auth provider: allowlist is the simplest role set; RBAC and AAL2 are config, not forks. One interface, three policies. |
| C2 | **Package manager** | npm (ai-web, cast, chat) vs pnpm (rentals, LAS, perf) | Standardize the shared package on **pnpm**; sites that consume it can stay on npm via the published package. Decide before first publish. |
| C3 | **Next.js version** | 14.2 (LAS, perf) vs 15.5 (ai-web, chat) vs 16.2 (cast, rentals) | Target the shared package at the **lowest supported (14.2)** API surface, or bump the laggards. Affects server-action and async-API usage. |
| C4 | **Data access pattern** | service-role-bypasses-RLS (ai-web) vs RLS-enforced-everywhere (LAS, perf, rentals) | For a platform holding PII (LAS minors, cast contacts), **RLS-enforced is the standard**; service-role only for explicit jobs. ai-web should migrate. |
| C5 | **Multi-tenancy** | single-tenant (ai-web, cast) vs workspace (rentals) vs client (chat, perf) vs tenant (LAS) | Chassis should assume a tenant boundary from day one (cheapest now, painful to retrofit), even where a site runs single-tenant. |
| C6 | **i18n/RTL** | hard requirement (LAS ar default, cast) vs absent (rentals, chat, perf) | Chassis includes next-intl + dir-aware layout as opt-in. LAS privacy + RTL rules are non-negotiable for that module. |
| C7 | **Theme tokens** | Greynab electric-green `#00f93a` (studio, perf) vs lime `#D4F26B` (cast) vs per-site (ai-web theme picker) | One token contract, per-site values. Do not hardcode a single accent. |
| C8 | **Service surface** | server actions (rentals, perf) vs API routes (ai-web, cast, chat) | Chassis supports both; shared modules expose logic as framework-agnostic functions, with thin route/action adapters per site. |

---

## 6. Proposed shape of `admin-core` (for your review, not yet built)

**Chassis (always present):** app shell, theme token contract, pluggable Supabase auth
(allowlist | RBAC | +AAL2), tenant boundary, audit log (cast's trigger pattern), feature
flags, job/cron runner, CSV util, platform-health page, KPI dashboard pattern.

**Shared modules (opt-in per site):** Leads/CRM funnel (the wedge), AI copilot + insights,
connectors hub, user/role management, approval/review queue, moderation/flags, Stripe
billing (per the `stripe-onsite-checkout` skill), marketing suite (content/segments/email/
broadcast).

**Per-site modules (live in each repo, depend on core):** the unique features in section 4.

**Home:** new dedicated private repo `admin-core`, consumed as a dependency. The existing
scaffold in `stryvia-ai-website` PR #34 (`admin-core/`, branch `claude/admiring-lovelace-hIcME`)
is the starting skeleton: it already has the chassis (Supabase OTP + allowlist, shell, theme,
AI copilot, connectors), a module system, and a CRM module. Recommendation: lift that scaffold
into the new repo, reconcile conflicts C1-C8 above, then port the shared modules.

---

## 7. What I need from you

Per the plan, I stop here for review. Decisions that unblock building:

1. **Confirm the cut** in sections 3-4: anything you want moved between "shared" and
   "per-site"?
2. **Resolve C1-C8** (or tell me to proceed with my recommendations).
3. **Confirm the home:** create the new `admin-core` repo now, or keep iterating in the
   PR #34 scaffold first?

No code, schema, or repo creation happens until you answer.
