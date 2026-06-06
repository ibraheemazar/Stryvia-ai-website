# admin-core

A reusable admin-panel starter for all of your websites. Instead of rebuilding a
dashboard, auth, an AI copilot, and channel integrations for every new site, you
drop in `admin-core`, point it at the site's Supabase project, and switch on the
**modules** that site needs.

It was extracted from the Stryvia admin panel and made generic. Nothing in here
mentions Stryvia, hardcodes a schema, or assumes a particular business — that all
lives in **modules** you opt into per site.

> Status: **scaffold**. This is the foundation (the "chassis" + the module
> system + the shared CRM module). It is intentionally isolated from the host
> website's build (see `tsconfig` `exclude`) and is meant to be lifted into its
> own repo / npm package later. See `ARCHITECTURE.md` for the full inventory of
> what the original Stryvia panel contained and the migration plan.

## The idea: a chassis + pluggable modules

```
┌─────────────────────────── admin-core (shared, every site) ───────────────────────────┐
│  Auth (Supabase OTP + email allowlist)   Shell + nav   Theme   AI Copilot   Connectors  │
└────────────────────────────────────────────────────────────────────────────────────────┘
            ▲                         ▲                          ▲
            │ enables                 │ enables                  │ enables
   ┌────────┴────────┐      ┌─────────┴─────────┐       ┌────────┴─────────┐
   │  crm module     │      │  marketing module │       │  your-own module │
   │ conversations,  │      │ campaigns, content│       │ orders, posts,   │
   │ leads, scoring  │      │ segments, A/B …   │       │ whatever a site  │
   └─────────────────┘      └───────────────────┘       │ needs            │
        (shared by               (opt-in)               └──────────────────┘
       funnel sites)
```

- **The chassis is identical on every site.** Auth, the shell/nav, theming, the
  floating AI copilot, and the channel connectors (email/SMS/WhatsApp/Slack).
- **Modules are per-site.** Each module brings its own nav tab, its own UI, its
  own API routes, and its own SQL. A site's `admin.config.ts` lists which
  modules are on. A blog site might enable only a `posts` module; a funnel site
  enables `crm` + `marketing`.

## Adopting it in a new website (Next.js App Router)

1. **Copy `admin-core/` into the new repo** (later: `npm i @you/admin-core`).
2. **Add the core env vars** (`.env.example`) — Supabase URL/anon/service-role
   keys, `ADMIN_EMAIL_ALLOWLIST`, and `ANTHROPIC_API_KEY` for the copilot.
3. **Create `admin.config.ts`** at the site root listing the brand + modules:

   ```ts
   import { defineAdminConfig } from "@/admin-core/src/config";
   import { crmModule } from "@/admin-core/src/modules/crm";

   export const adminConfig = defineAdminConfig({
     brand: { name: "ACME ADMIN" },
     modules: [crmModule],            // turn on only what this site needs
     copilot: { enabled: true },
   });
   ```

4. **Mount the panel** at a hard-to-guess route, e.g. `app/supadmin/page.tsx`:

   ```tsx
   "use client";
   import { AdminApp } from "@/admin-core/src/ui/AdminApp";
   import { adminConfig } from "@/admin.config";

   export default function Page() {
     return <AdminApp config={adminConfig} />;
   }
   ```

5. **Wire the API routes.** The copilot lives at `POST /api/admin/copilot`; each
   module owns `/api/admin/<moduleId>/...`. See `modules/crm/api.ts` for the
   pattern — every handler starts by calling `verifyAdmin()`.
6. **Run the SQL** for each enabled module (`modules/<id>/schema.sql`) against
   that site's Supabase project.

## What's in the box (scaffold)

| Area | File(s) | Reusable? |
| --- | --- | --- |
| Config + module system | `src/config.ts`, `src/modules/types.ts` | core |
| Auth (OTP + allowlist, fail-closed) | `src/auth/*` | core |
| Supabase clients (server + browser) | `src/auth/supabase-*.ts` | core |
| Anthropic + streaming helpers | `src/ai/*` | core |
| Channel connectors (SES/Twilio/WhatsApp/Slack) | `src/connectors/index.ts` | core |
| Shell, login, theme, copilot UI | `src/ui/*` | core |
| **CRM module** (conversations/leads/scoring) | `src/modules/crm/*` | opt-in |

## Styling

The UI uses plain Tailwind utility classes (neutral `zinc` palette) plus a single
`--admin-accent` CSS variable, so it works in any Tailwind project without
importing a design system. Override `--admin-accent` to brand it per site.

## Security model (unchanged from the original)

- Login is **Supabase email OTP**; access is gated by `ADMIN_EMAIL_ALLOWLIST`.
- The allowlist **fails closed** — empty allowlist denies everyone.
- The browser only ever holds the anon key. All privileged data access happens
  in server routes with the **service-role** key, *after* `verifyAdmin()` passes.
