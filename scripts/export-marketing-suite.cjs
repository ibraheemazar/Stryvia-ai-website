const fs = require("fs");
const path = require("path");

// Build a single self-contained markdown doc of the Stryvia "marketing + AI
// intelligence + chat-funnel" suite, for porting into another project via its
// code chat. Dynamic fences so embedded backticks never break the doc.

const GROUPS = [
  ["DATABASE SCHEMA — run these migrations in the target Supabase project (in order)", [
    "supabase/migrations/0001_init.sql",
    "supabase/migrations/0002_marketing.sql",
    "supabase/migrations/0003_landing.sql",
  ]],
  ["DESIGN SYSTEM — merge these tokens/utilities into the target's global stylesheet (Tailwind v4)", [
    "src/styles/globals.css",
  ]],
  ["SHARED LIBS", [
    "src/lib/utils.ts",
    "src/lib/supabase.ts",
    "src/lib/supabase-browser.ts",
    "src/lib/admin-auth.ts",
    "src/lib/anthropic.ts",
    "src/lib/notify.ts",
  ]],
  ["CHAT + LEAD-CAPTURE BACKEND (feeds the funnel: creates conversations + leads)", [
    "src/lib/chat/types.ts",
    "src/lib/chat/systemPrompt.ts",
    "src/lib/chat/store.ts",
    "src/lib/chat/summarize.ts",
    "src/lib/attribution.ts",
    "src/lib/consent.ts",
    "src/lib/analytics.ts",
    "src/app/api/chat/route.ts",
    "src/app/api/lead/route.ts",
    "src/app/api/early-access/route.ts",
  ]],
  ["CHAT UI (the concierge that generates funnel data — port or replace with your own)", [
    "src/components/ui/Button.tsx",
    "src/components/ui/Bracket.tsx",
    "src/components/chat/Markdown.tsx",
    "src/components/chat/StatusStack.tsx",
    "src/components/chat/ChatProvider.tsx",
    "src/components/chat/ChatPanel.tsx",
    "src/components/chat/ChatDock.tsx",
    "src/components/chat/HandoffForm.tsx",
    "src/components/chat/ChatSeedButton.tsx",
    "src/components/forms/EarlyAccessForm.tsx",
  ]],
  ["MARKETING SERVER LIBS", [
    "src/lib/marketing/data.ts",
    "src/lib/marketing/actions.ts",
    "src/lib/marketing/brand.ts",
    "src/lib/marketing/connectors.ts",
    "src/lib/marketing/integrations.ts",
    "src/lib/marketing/performance.ts",
    "src/lib/marketing/email.ts",
    "src/lib/marketing/landing.ts",
    "src/lib/marketing/jobs.ts",
  ]],
  ["AI INSIGHTS SERVER LIBS (analytics snapshot + advisor + copilot)", [
    "src/lib/insights/ga4.ts",
    "src/lib/insights/snapshot.ts",
    "src/lib/insights/context.ts",
    "src/lib/insights/prompts.ts",
    "src/lib/insights/stream.ts",
  ]],
  ["API ROUTES (admin-auth gated)", [
    "src/app/api/admin/data/route.ts",
    "src/app/api/admin/conversation/route.ts",
    "src/app/api/admin/lead/route.ts",
    "src/app/api/admin/insights/route.ts",
    "src/app/api/admin/insights/ask/route.ts",
    "src/app/api/admin/copilot/route.ts",
    "src/app/api/admin/marketing/route.ts",
    "src/app/api/admin/marketing/advisor/route.ts",
    "src/app/api/admin/marketing/content/route.ts",
    "src/app/api/admin/marketing/segments/route.ts",
    "src/app/api/admin/marketing/email/route.ts",
    "src/app/api/admin/marketing/automations/route.ts",
    "src/app/api/admin/marketing/integrations/route.ts",
    "src/app/api/admin/marketing/landing/route.ts",
  ]],
  ["ADMIN UI (the dashboard itself — mount at a private route, e.g. /supadmin)", [
    "src/app/supadmin/page.tsx",
    "src/app/supadmin/layout.tsx",
    "src/app/supadmin/AdminLogin.tsx",
    "src/app/supadmin/AdminShell.tsx",
    "src/app/supadmin/AdminThemePicker.tsx",
    "src/app/supadmin/AdminDashboard.tsx",
    "src/app/supadmin/ConversationDetail.tsx",
    "src/app/supadmin/AdminCopilot.tsx",
    "src/app/supadmin/insights/AdminChat.tsx",
    "src/app/supadmin/insights/AnalyticsView.tsx",
    "src/app/supadmin/marketing/MarketingDashboard.tsx",
  ]],
];

function fenceFor(content) {
  const runs = content.match(/`+/g) || [];
  const max = runs.reduce((m, r) => Math.max(m, r.length), 0);
  return "`".repeat(Math.max(3, max + 1));
}
const LANG = { ts: "ts", tsx: "tsx", sql: "sql", css: "css", js: "js", json: "json" };

const header = `# Stryvia Marketing + AI Intelligence Suite — Portable Export

A self-contained transplant of the marketing dashboard, the AI analytics
deep-dive, the admin Copilot, and the chat/lead-capture funnel that feeds them.
Generated from the live Stryvia codebase.

---

## ▶ HOW TO USE THIS
Paste this entire file into your other project's code chat (Claude Code) with
the prompt below. It will integrate the suite, adapting to your repo.

### PROMPT TO PASTE ALONGSIDE THIS FILE
> Integrate the "Stryvia Marketing + AI Intelligence Suite" defined in this
> document into this project. Steps:
> 1. Confirm the stack matches (Next.js App Router + TypeScript + Tailwind v4).
>    If not, adapt the components to the local conventions.
> 2. Create the Supabase tables from the DATABASE SCHEMA section (run the
>    migrations in order in the target Supabase project).
> 3. Add the environment variables listed in PREREQUISITES to the project.
> 4. Merge the DESIGN SYSTEM tokens/utilities into the global stylesheet so the
>    \`sv-*\` classes resolve (or remap them to the local design system).
> 5. Create each file at the path given in its heading, using the provided
>    contents. Fix import paths to match the local alias (\`@/\` → src/).
> 6. Wire the admin dashboard at a private route (e.g. /supadmin) and gate it
>    with the email allowlist.
> 7. If this site has its own leads/analytics source instead of the chat funnel,
>    adapt the queries in \`src/lib/marketing/data.ts\` and
>    \`src/lib/insights/context.ts\` to read from it.
> 8. Run lint, typecheck, and build; fix any integration errors.
> Ask me before making large architectural changes.

---

## ARCHITECTURE
- **Chat + lead capture** (\`/api/chat\`, \`/api/lead\`) writes \`conversations\`,
  \`messages\`, \`leads\` to Supabase — this is the funnel data source.
- **Marketing dashboard** (\`/supadmin\` → Marketing) reads/derives metrics,
  generates content/segments/automations/landing pages, and pulls live
  ad/analytics performance via connectors.
- **AI Intelligence**: an analytics deep-dive (GA4 + first-party funnel) with a
  streamed Ask-AI advisor, plus a global Copilot — all on Claude, admin-gated,
  grounded strictly in real data (never invents numbers).

## PREREQUISITES
- **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · React 19.
- **Packages:** \`@anthropic-ai/sdk\`, \`@supabase/supabase-js\`,
  \`@aws-sdk/client-sesv2\` (lead email; optional), \`next\`, \`react\`.
- **Environment variables:**
  - \`ANTHROPIC_API_KEY\` (+ optional \`ANTHROPIC_MODEL\`, default claude-opus-4-8)
  - \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`
  - \`ADMIN_EMAIL_ALLOWLIST\` (comma-separated admin emails — fail-closed)
  - GA4 analytics card: \`GA4_PROPERTY_ID\`, \`GA4_CREDENTIALS_JSON\` (service account)
  - Optional connectors: \`SEARCH_CONSOLE_SITE\`, \`GOOGLE_SERVICE_ACCOUNT_JSON\`,
    \`META_ACCESS_TOKEN\`/\`META_AD_ACCOUNT_ID\`, \`GOOGLE_ADS_*\`
  - Optional lead email: \`LEAD_NOTIFY_TO\`, \`LEAD_NOTIFY_FROM\`, \`SES_REGION\`,
    \`SES_ACCESS_KEY_ID\`, \`SES_SECRET_ACCESS_KEY\`
  - Optional: \`SLACK_WEBHOOK_URL\`, \`WHATSAPP_*\`, \`TWILIO_*\`, \`CRON_SECRET\`
- **Admin auth:** Supabase Auth (magic link) + the email allowlist in
  \`src/lib/admin-auth.ts\`.

## NOTES & GOTCHAS
- Every component uses the \`sv-*\` design tokens — port the DESIGN SYSTEM section
  or remap classes, or it renders unstyled.
- All \`/api/admin/*\` routes are gated by \`verifyAdmin\`; the admin SPA passes the
  Supabase access token as a Bearer header.
- The AI is grounded strictly in supplied data and forbidden from inventing
  numbers; lead/conversation text is treated as untrusted (prompt-injection
  guard) in \`src/lib/insights/prompts.ts\`.
- If you don't port the public chat UI, bring your own UI that POSTs to
  \`/api/chat\` and \`/api/lead\`, or the funnel panels stay empty.

---

# FILES
`;

let out = header;
let missing = [];
for (const [title, files] of GROUPS) {
  out += `\n\n## ${title}\n`;
  for (const f of files) {
    if (!fs.existsSync(f)) {
      missing.push(f);
      continue;
    }
    const content = fs.readFileSync(f, "utf8");
    const fc = fenceFor(content);
    const ext = path.extname(f).slice(1);
    const lang = LANG[ext] || "";
    out += `\n### \`${f}\`\n${fc}${lang}\n${content}\n${fc}\n`;
  }
}

fs.writeFileSync("MARKETING-SUITE-EXPORT.md", out);
const lines = out.split("\n").length;
console.log(`Wrote MARKETING-SUITE-EXPORT.md — ${lines} lines, ${(out.length / 1024).toFixed(0)} KB`);
if (missing.length) console.log("MISSING (skipped):", missing.join(", "));
