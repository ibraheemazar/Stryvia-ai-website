# Admin Core: The Ultimate Admin Spec

Status: proposal for review. This extends `ADMIN_CORE_COMPARISON.md` with the full target
feature set ("Everything"), the dual-consumer architecture (Stryvia HQ hub + per-site
template), and a build sequence. No code is built from this until the phasing is approved.

---

## 1. The model: one core, two consumers

There is exactly one codebase. It powers two things.

```
                         admin-core  (one private package)
        chassis + module registry + RLS helpers + auth providers + theming
                                    |
        +---------------------------+---------------------------+
        |                                                       |
   PER-SITE ADMIN                                          STRYVIA HQ HUB
   imports core, enables                                   imports core, ALL modules on,
   the modules it wants                                    multi-property mode: reads and
   via admin.config.ts,                                    aggregates across every site
   points at its own Supabase                              (revenue, search, alerts)
```

- **Every feature is a module.** Every module is available to every consumer. A site turns
  features on/off in `admin.config.ts`. "Customizable with all features" is literally a set
  of config flags, not a fork.
- **Build once, get everywhere.** A feature added to the core is instantly available to all
  six per-site admins and to HQ.
- **Per-site stays isolated.** Each site keeps its own Supabase project, env, and auth
  policy. Enabling HQ requires zero data changes to a site.

### How HQ reads across sites (the one data decision)

The six sites already run separate Supabase projects (different refs). HQ does **not** force
consolidation. Instead:

- HQ holds an **encrypted site-connection registry** (per site: Supabase URL + service key,
  Stripe tag, scopes), stored with pgsodium/Vault.
- HQ aggregates on read and **caches rollups** (MRR, lead counts, churn, anomalies) into its
  own small Postgres so dashboards are fast and don't hammer each site.
- Cross-site search federates queries to each site's API with the viewer's scoped token.

Default chosen: federated read + cached rollups. Central-Supabase consolidation is a future
option, not a prerequisite.

---

## 2. Module catalog (Everything)

Each entry: what it is, and whether it lives in the **chassis** (always present), as a
**shared module** (opt-in, reusable), or a **per-site module** (domain-specific, in the site
repo, conforms to the module interface).

### Chassis (always present)
- App shell: nav, header, theme, responsive layout, command palette mount
- Theme token contract (per-tenant values; Greynab `#00f93a` default)
- Pluggable auth provider: allowlist | RBAC | +AAL2 OTP, behind one interface
- Tenant boundary + (in HQ) property switcher
- Audit log: immutable, trigger-based (cast's `audit_row_change` pattern)
- Feature flags + experiment targeting
- Job/cron runner with run logs (generalizes `sync_log`)
- RLS helper library and the typed service-client cast patterns
- Platform-health page; CSV import/export utility

### Shared modules (opt-in per site, all sites may enable)

Tier 1
- **Leads/CRM funnel** (conversations -> leads -> scoring -> status workflow)
- **Agentic copilot** (streaming chat with tool-use that can take audited, approved actions)
- **Anomaly detection & alerting** (spend spikes, lead drop, error/churn, failed jobs)
- **Permission editor + maker-checker approvals** (custom roles, resource-level perms, 4-eyes)
- **PDPL/GDPR data center** (per-subject export, right-to-be-forgotten, consent, retention)
- **Connection & secrets health** (token status/expiry, test + rotate)
- **Mobile PWA + push notifications**
- **AI insights/recommendations** (batch analysis writing structured records)

Tier 2
- **Marketing suite** (content studio, segments, email, SMS/WhatsApp broadcast, promos)
- **Marketing automations engine** (trigger -> action workflows, AI-built)
- **Unified notifications center** (in-app + push + email digests, per-admin prefs)
- **Scheduled digests / reports** (PDF + email/WhatsApp rollups)
- **Unified support inbox** (email + WhatsApp + chat handoffs)
- **Outbound webhooks / event bus** (Zapier/Slack/CRM fan-out)
- **Impersonation / view-as-user** (fully audited)
- **Security center** (login alerts, session mgmt, MFA status, RLS advisor)
- **Saved views, pinned dashboards, bulk actions + undo**
- **Connectors/integrations hub** (registry-driven, status + non-secret config)

Tier 3
- **Localization manager** (in-app i18n string editor; RTL-aware for LAS AR/EN/FR)
- **Developer/API portal** (API keys, rate limits, usage)
- **Real-time presence & live updates** (Supabase Realtime)
- **White-label / theming studio** (per-tenant logo, colors, domain; resale-ready)

### HQ-only modules
- **Property switcher + estate home**
- **Revenue cockpit** (MRR/ARR, subscriptions, churn, offline payments across all sites)
- **Cross-site global search + command palette**
- **Estate-wide anomaly board + unified alert feed**
- **Site-connection registry** (encrypted credentials, scopes, health)

### Per-site (domain) modules
- rentals: scan in/out, NIIMBOT labels, units/SKUs/packages, inspection, fleet
- cast: talent DB + visibility tiers, selftapes, shortlists, briefs, talent import
- chat: bot builder, pgvector RAG KB, pilot countdown, referrals
- LAS: AI enrichment, WhatsApp one-tap approval, CD verification tiers, minor consent locks, news
- performance: Ads + GA4 ingestion, GAQL builders, ad recommendations, locked write/CRM/offline flags
- ai-website: (its marketing modules become shared above)

---

## 3. Conflicts resolved (recommendations adopted unless you object)

From the comparison doc C1-C8, the dual-consumer model resolves most of them:

- **C1 auth:** pluggable provider. allowlist/RBAC/AAL2 are config, not forks. PII sites
  (LAS, cast) default to RBAC + RLS; AAL2 on for admin.
- **C2 pkg mgr:** core ships **pnpm**; sites consume the published package regardless.
- **C3 Next.js:** core targets the **Next 15 App Router** surface; bump Next 14 sites (LAS,
  performance) when they adopt. (15 is the median; 16 sites already ahead.)
- **C4 data access:** **RLS-enforced everywhere**; service-role only for explicit jobs.
  ai-website migrates off blanket service-role reads.
- **C5 tenancy:** tenant boundary assumed from day one in core.
- **C6 i18n/RTL:** opt-in module; mandatory for LAS.
- **C7 theme:** one token contract, per-site values.
- **C8 service surface:** modules expose framework-agnostic functions; thin route/action
  adapters per site.

---

## 4. Build sequence (phased, since scope is "Everything")

**Phase 0 - Foundation.** New private repo `admin-core`. Lift the PR #34 scaffold (chassis +
module system + CRM) into it. Define the module interface and `admin.config.ts` enablement.
Set up the HQ app skeleton and the site-connection registry. Resolve C1-C8.

**Phase 1 - Ultimate v1 (Tier 1 + HQ core).** Chassis hardened; Leads/CRM; agentic copilot;
anomaly alerting; permission editor + approvals; PDPL center; connection/secrets health;
mobile PWA + push; AI insights. HQ: property switcher, revenue cockpit, cross-site search,
estate alert feed. Wire **one** pilot per-site (recommend cast or chat) end to end.

**Phase 2 - Tier 2.** Marketing suite + automations, notifications center, scheduled digests,
support inbox, webhooks/event bus, impersonation, security center, saved views/bulk actions,
connectors hub. Onboard 2-3 more sites.

**Phase 3 - Tier 3 + full rollout.** Localization manager, dev/API portal, realtime presence,
white-label studio. Port remaining per-site domain modules. All six sites on the core.

Each phase: typecheck-clean gate, RLS on every table, audit on every sensitive write, no
secrets in the browser bundle.

---

## 5. Step 0 dependency audit (per CLAUDE.md, one upfront list)

To be produced before Phase 0 code: consolidated list of packages (pnpm), the new GitHub
repo + Vercel project for HQ, the HQ Supabase project, env vars (per-site connection secrets,
encryption key, push/VAPID keys, all existing per-site keys), and the dashboard setup the
human does once (Supabase auth providers, Twilio Verify, Google OAuth redirect URIs, Stripe).

---

## 6. Open questions before Phase 0

1. **Pilot site for Phase 1** end-to-end: cast, chat, or other?
2. **HQ home + repo name:** confirm new private repo `admin-core` (package) and a separate
   `stryvia-hq` app, or one repo with both. Default: one `admin-core` repo (package + HQ app
   + example per-site), sites consume the package.
3. **Push channel** for mobile alerts: web push (PWA) only, or also WhatsApp/SMS via the
   Twilio setup that already exists across repos? Default: web push + reuse Twilio for
   high-severity.

No repo creation or code until these three are answered (or you say proceed with defaults).
