# Stryvia Idea Lab — Architecture

Route: `/lab` (Arabic `/ar/lab`). Admin: `/supadmin/lab` (`/admin/lab` redirects).
Brief: `STRYVIA_IDEA_LAB_CLAUDE_CODE_BRIEF.md` (the founder's spec). This document records how it was built and the decisions that differ from it.

## Modules (`src/lib/lab/`)

| Module | Role |
|---|---|
| `env.ts` | zod-validated settings; the Lab disables itself (503 page) on a bad config, never crashes the site. Validated at boot by `src/instrumentation.ts`. |
| `session-auth.ts` | Visitor identity: HMAC-signed HttpOnly cookie `{vid, gen, exp}`. `requireSessionOwner()` is the one chokepoint every visitor route calls (repo-guard test). |
| `magic-link.ts` | Single-use, 7-day links stored as sha256 hashes. GET renders a confirm page; POST consumes (email scanners cannot burn a link). |
| `rate-limit.ts` | Durable fixed-window limits via SQL `lab_rate_limit_hit`; keys are hashes, never raw IP/email. |
| `slots.ts` | The 18 universal slots, confidence/evidence merge rules, coverage maths. Pure. |
| `phase.ts` | Deterministic phase controller (code decides transitions, not the model). Pure. |
| `extractor` (in `engine.ts`) | `claude-sonnet-5` structured output → `ExtractorDiffSchema` (zod) → merge. |
| `engine.ts` | One visitor turn: lock → persist user msg → extract → phase → lens/summary → stream interviewer → persist reply → meta frame. |
| `ai.ts` / `ai-mock.ts` | The only model boundary: caching (frozen system block), structured outputs, timeouts, bounded retry, refusal/max_tokens handling, usage → `lab_ai_calls` + cost. Mock is refused in production. |
| `brief.ts`, `render.ts` | `claude-opus-5-5` structured brief; HTML/text rendering (RTL-correct, bidi-isolated, escaped). `translateBrief` / `reviseBrief` read ONE saved version (never the transcript) and save the result as a *proposal* that becomes current only when the visitor accepts it; `acceptBriefVersion` refuses a proposal whose source is no longer current (stale). |
| `brief-check.ts` | Deterministic guards run on every model-generated version: number/currency/percent preservation (Western and Arabic-Indic digits, number words, Arabic duals) and a script-share language check. A failing translation is never saved (422 `facts_lost` / `language_mismatch`; the source stays intact). Pure. |
| `brief-diff.ts`, `brief-view.ts` | Field-level diff shown to the visitor before accepting a proposal; version statuses (current / submitted / proposed / superseded); the visitor-facing view of a version (kind, source version, document language). Pure. |
| `locks.ts` | One lock per session (`lab_sessions.pending_turn_id`, TTL 125 s) shared by turns, retries, finish, edits, translations, revisions and submit, so no two operations can overwrite each other. |
| Session `flags` | `test`, `no_contact`, `decision_demands` on `lab_sessions.flags`, set from extractor signals OR keyword checks on the visitor's words, never cleared, rendered structurally in brief/print/packet and enforced by the admin send route. |
| `assessor.ts` | Private scoring; verdict recomputed in code (`lab-rubric.config.ts`), model verdict stored for comparison. Never reachable from visitor routes (repo-guard). |
| `notify.ts`, `submit.ts`, `mail.ts`, `emails.ts` | Founder email/WhatsApp, visitor brief copy, idempotent post-submit pipeline (`after()` + hourly `lab_sweep`). |
| `guardrails.ts` | Untrusted wrapping, output lint (EN/AR banned claims), injection heuristics, escaping/bidi helpers. |
| `events.ts`, `log.ts` | PII-free append-only events + structured JSON logs with request ids. |

Config: `src/config/lab.config.ts` (product), `src/config/lab-rubric.config.ts` (scoring). Prompts: `src/lib/lab/prompts/*` with `PROMPT_VERSION`.

## Brief version model

`lab_briefs` rows carry `kind` (`generated` | `edited` | `translated` | `revised`) and `source_version`. `lab_sessions.current_brief_version` points at what the visitor sees; `lab_sessions.submitted_brief_version` is frozen at submission and is the only version print, the brief-copy email, the admin detail and the review packet show afterwards. Every mutating call names the version it starts from (`baseVersion`); a mismatch is a 409 `stale`. Document language is a property of the version, not of the page URL or the conversation language: it drives labels, direction, the translate target and print headings.

## Manual review controls (server-side)

Submission sets `status=submitted` and never anything else; the assessor writes only its own table and `assessment_status`. `POST /api/admin/lab/[id]/decision` requires `confirmed: true`, a reviewer (`canDecide`: `LAB_REVIEWER_EMAILS` ⊆ admin allowlist) and a submitted session. `POST …/send-email` is two steps: `mode: "preview"` (renders, sends nothing) then `mode: "send", confirmed: true` (+ `overrideNoContact: true` for a visitor who asked not to be contacted). Refusals and sends are audited in `lab_events` with the reviewer's identity. A repo-guard test asserts no visitor, AI or cron module references the decision table or the sender.

## Scheduled jobs and the harness

`vercel.json` runs `lab_sweep` (hourly: resumes post-submit work `after()` left behind, clears stale turn locks), `lab_spend_alert` (hourly: monthly alert + hard cap that pauses new sessions) and `lab_retention` (daily: hard-deletes sessions past `LAB_RETENTION_MONTHS`, orphaned visitors, expired links). `/api/cron` accepts only `Authorization: Bearer $CRON_SECRET` once the secret exists; lab tasks require it unconditionally.

`/api/lab-harness` (visitor-turn, judge, inspect) serves the persona harness. It is gated three ways: `LAB_HARNESS_ENABLED=true`, the cron bearer secret, and a refusal in production. It lives outside `src/app/api/lab/` so the repo-guard test that forbids assessment access from visitor code still applies to every visitor route.

## Wire protocol

`POST /api/lab/session/:id/turn` streams `text/plain`: visible text, then `\x1e`, then one JSON meta frame `{phase, progress, turnId, status, options?, ended?, budgetWarning?, error?}` — the same protocol as `/api/chat`.

## Data

Migration `supabase/migrations/0006_idea_lab.sql` (reversal in `down/`). All `lab_*` tables have RLS enabled and **no policies**: anon/authenticated read nothing; the service role is used only from server routes. Visitor isolation is enforced in `session-auth.ts` (cookie → visitor → session ownership → 404 otherwise). This differs from the brief's "RLS via magic-link identity" wording; the effect (a visitor can only reach their own sessions; nothing else can read the tables) is the same and needed no Supabase dashboard setup. Upgrade path if per-user DB policies are wanted later: enable Supabase anonymous sign-in, add `@supabase/ssr`, store `auth.uid()` on `lab_sessions`, and add `using (visitor_id = auth.uid())` policies.

## Deviations from the brief (stated)

- Admin at `/supadmin/lab`, not `/admin/lab` (the site's admin lives at `/supadmin`; `/admin/lab` redirects).
- No server-side PDF library: JS PDF renderers mangle Arabic shaping. The brief email is clean RTL-correct HTML; "PDF" is the print-optimised page (`/lab/s/:id/brief`) saved from the browser.
- Voice provider comparison ships as a document + bench script; the real-sample benchmark needs provider keys that do not exist yet.
- Branch: the session was bound to `claude/project-plan-umqt3g`, so work lives there instead of `feature/idea-lab`.
