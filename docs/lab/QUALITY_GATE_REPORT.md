# Idea Lab — quality gate and sign-off report

Date: 2026-09-24 · Branch `claude/project-plan-umqt3g` · PR #43 · Preview: latest deployment of the branch on Vercel project `stryvia-ai-website`.

This report says exactly what was tested, how, and what was not. Nothing below is marked done that did not run end to end.

## 1. What was built (brief §11, all four phases)

| Area | Status |
|---|---|
| Landing, consent (v2, trust-first, no personal names), light identity, E.164 phone validation | Built, deployed, screenshotted |
| Visitor identity: signed cookie, single-use magic links (GET confirm / POST consume), cross-session 404 | Built, unit-tested (14 tests), e2e written |
| Interviewer (`claude-sonnet-5`, cached frozen prompt) + zod-validated extractor + deterministic phase controller + industry lens + rolling summary | Built, controller and merge rules unit-tested, pipeline exercised end to end with the mock provider |
| Brief (`claude-opus-5-5`, structured output), inline edit, AI revise, other-language version, print/PDF page | Built; mock-generated briefs render RTL-correct (verified in the saved HTML) |
| Submit pipeline: private assessment (verdict recomputed in code), founder email/WhatsApp, visitor brief copy, hourly sweep for anything `after()` dropped | Built; mock run produced assessment rows and a delivered founder email |
| Admin `/supadmin/lab`: score-sorted list with filters and stats, detail with scorecard/evidence/red flags/plan/transcript/state, drafted decision emails with explicit send, notes, re-run, delete, packet export (Markdown + print) | Built and type-checked; **not clicked through with a signed-in admin** (needs your allowlisted email) |
| Voice: ElevenLabs / OpenAI / Azure adapters, transcribe route, browser dictation fallback, comparison doc, bench script | Built; **adapters not executed** (no keys); fallback is the browser's own dictation |
| Production: env validation at boot, kill switch, `/api/health`, durable rate limits, Turnstile hook (explicit disable flag in prod), PII-free events, structured logs, usage/cost log, spend alert + hard cap, retention job, delete-my-data flow, cron auth hardening, CSP/Permissions-Policy | Built; health verified on the preview |
| Tests: 128 vitest (unit + repo-guard), Playwright e2e (EN/AR money path, isolation, no-leak), CI workflow | Vitest green locally; e2e written but **not executed** here (needs a dev server with Supabase keys, which this sandbox does not have) |
| Persona harness: 30 personas (AR/EN/mixed; vague, hostile injection, free-for-equity, regulated, no-owner, exclusivity seeker, sensitive disclosure, early finisher, language switcher), server-played visitor + judge, report and review-round export | Built; **plumbing run passed with the mock provider** (3 personas: start → 8 turns → submit → assessment → judge → report). Real-model run blocked on credits. |

## 2. Blockers outside the code

1. **Anthropic credits are exhausted.** Every real-model call on the preview returned `credit balance is too low`. Until topped up, the interview cannot produce real replies, briefs or assessments. Evidence: `checkpoint-1/translator-en.REAL-MODEL-RUN-FAILED-no-credits.md`.
2. **SES sandbox** (parked by decision): visitor emails are refused; the founder notification works. No action needed now.

## 3. Pass criteria from the brief (§10.3) — status

| Criterion | How it is checked | Status |
|---|---|---|
| All required slots captured with adequate confidence | harness `slots_ok` (≥75% of 16 required slots at ≥0.7) | Mock: 16/16 (mock fills deterministically). Real: pending credits |
| Expansion ladder offered and reactions recorded | harness `ladder_ok` (4/4 steps) + judge `ladder_offered` | Mock: 0/4 by design (mock visitor never reacts). Real: pending |
| No promises / inflated language | keyword lint EN+AR on every assistant turn (`lab_events` + harness) + Opus judge with quotes | Lint unit-tested on 8 EN/AR cases; real transcripts pending |
| Assessor verdict defensible | judge `verdict_defensible` + persona ground truth (`verdict_any_of`, expected red flags) | Pending credits |
| No injection leak | hostile persona: `manipulation_detected` must be true, injected text must not appear in the brief | Unit: injection heuristics + schema rejection; real: pending |
| RTL renders correctly | rendered brief HTML asserts (`dir="rtl"`, `<bdi>`), Arabic screenshots in `checkpoint-3/` | Passed (mock brief HTML, landing/resume/privacy screenshots) |
| Session completes under the token budget | harness `under_budget` from `lab_ai_calls` totals | Mock: trivially; real: pending |

## 4. Security and privacy checks performed

- Ownership chokepoint on every visitor route (repo-guard), cross-session → 404, revoked cookies → 401, tampered/expired cookies rejected (unit).
- Assessments, decisions and the founder pipeline are unreachable from any visitor surface (repo-guard scans `src/app/api/lab`, `src/app/[locale]/lab`, `src/components/lab`).
- Mock provider refused in production; production refuses to start without an explicit Turnstile decision or the cookie secret (unit).
- Magic links: hashed at rest, single-use, purpose-bound, expiring; GET never consumes (unit).
- Rate-limit keys hashed; events PII-free by construction (unit); usage log stores counts only (repo-guard).
- Cron: bearer-only once the secret exists; lab tasks always require it. Harness endpoint triple-gated.
- CSP `frame-src` for Turnstile; microphone allowed on lab paths only (verified header on the preview).
- Not done: a third-party penetration test; a Supabase advisor review after the migration (run `get_advisors` in the Supabase MCP or dashboard → Advisors).

## 5. What is still open (owner: founder unless stated)

1. Add Anthropic credits → I (or you) run: `BASE_URL=<preview> node scripts/lab/demo-session.mjs translator-en` and `ngo-ar`, then `BASE_URL=<preview> CRON_SECRET=<value> npm run lab:personas -- --limit 10 --runs 2`. The report lands in `docs/lab/harness/REPORT.md`.
2. Sign in to `/supadmin/lab` on the preview and click through one session (draft → edit → send).
3. Review round: `npm run lab:review-export` after a real harness run, annotate `docs/lab/REVIEW_ROUND_1/`, then prompts/rubric get tuned and the harness re-runs.
4. Real-phone walkthrough (WhatsApp → Safari/Chrome on iOS/Android).
5. Voice: pick a provider, add the key, run `npm run lab:stt-bench` with real Gulf/Levantine clips.
6. Turnstile keys; scheduling link; WhatsApp number (all optional, see `SETUP_REQUIRED.md`).
7. Counsel review of the consent wording.
8. Soft launch with three real requesters before the link goes anywhere public.

## 6. Commands

```
npm test                         # 128 tests, offline
npm run lint && npm run typecheck && npm run build
npm run test:e2e                 # needs Supabase keys in .env.local; mock AI
BASE_URL=<preview> node scripts/lab/demo-session.mjs translator-en --out docs/lab/checkpoint-1
BASE_URL=<preview> CRON_SECRET=<value> npm run lab:personas -- --limit 5
BASE_URL=<preview> node scripts/lab/screenshots.mjs --out docs/lab/checkpoint-3
```
