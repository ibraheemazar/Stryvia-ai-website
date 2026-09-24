# Idea Lab — checkpoint reports

Honest status per phase (brief §11): what was built, what was tested and how, what is untested, open questions, exact next step. Artefacts referenced live next to this file.

## Checkpoint 1 — Foundation

**Built.** Landing + consent + light identity; signed-cookie sessions with single-use magic links; streaming interviewer (`claude-sonnet-5`) with zod-validated state extraction, deterministic phase controller, per-session industry lens, rolling summary; brief generation and inline editing (`claude-opus-5-5`); submit pipeline; health check; boot-time env validation; durable rate limits; Turnstile hook; PII-free event log; structured logs; migration `0006_idea_lab` applied. Bilingual AR/EN with RTL fixes (Arabic heading face, logical CSS, bidi isolation).

**Tested and how.**
- `npm test` — 128 unit/repo-guard tests: phase transitions and caps, slot merge rules, extractor schema (rejects malformed and injected output), rubric maths and every verdict path, output guardrail EN/AR, cookie signing/tamper/expiry/revocation, cross-session 404, magic-link single use/expiry/purpose, env validation (prod refuses mock provider, missing cookie secret, silent Turnstile skip), rendering (RTL, `<bdi>`, escaping), packet export, decision-email fallbacks, and structural invariants (every visitor route uses the ownership chokepoint; no visitor surface references assessments; RLS on every table; consent version tied to copy; AR/EN catalogs have identical keys; security headers).
- `npm run lint`, `npm run typecheck`, `npm run build` — green. CI workflow runs all four on every PR.
- Preview deployment: `/api/health` → `db`, `ai`, `email`, `lab` true; `botProtection` false (expected); Permissions-Policy shows `microphone=(self)` on `/lab`.
- **Real-model end-to-end run: FAILED for an external reason.** `scripts/lab/demo-session.mjs translator-en` against the preview: every model call returned `400 … credit balance is too low` (Anthropic account has no credits). Evidence: `checkpoint-1/translator-en.REAL-MODEL-RUN-FAILED-no-credits.md`. The plumbing behaved correctly under failure: visitor messages persisted, `error:true` meta frames, Retry path, no 500s.
- **Mock-provider end-to-end run: PASSED in EN and AR** (`LAB_AI_PROVIDER=mock` on the preview, which is refused in production). Start → 12 turns → phase transitions by the real controller → finish → brief v1 → submit 200 → assessment row → founder email delivered. Evidence: `checkpoint-1/translator-en.MOCK.md`, `ngo-ar.MOCK.md`, the two `.MOCK.brief.html` files (Arabic one renders `dir="rtl"` with isolated Latin fragments). This proves plumbing, not interview quality.

**Untested.** Interview quality, brief quality and assessment quality with the real models (blocked on credits). Visitor emails (SES sandbox — parked by decision). Real phone walkthrough.

**Open questions.** None for the code; two human items in `SETUP_REQUIRED.md`.

**Next step.** Top up Anthropic credits → re-run `scripts/lab/demo-session.mjs` (EN + AR) and the persona harness.

## Checkpoint 2 — Judgment

**Built.** Private assessor with deterministic verdict recomputation; founder notifications (email; WhatsApp when configured); `/supadmin/lab` list (score-sorted, filters, stats) and detail (brief, scorecard with evidence, red flags, reasoning, proposed plan, transcript with raw voice text, slot state, lens, decisions, notes); actions with model-drafted, admin-edited emails and an explicit send; re-run assessment; delete; review packet (Markdown + print/PDF).

**Tested.** Unit: rubric/verdict paths, packet content, decision fallbacks (never promise/price/name a person), admin auth boundary (401). Mock run: two submissions reached `assessment_status=done`, verdict `paid_build` (mock scores), founder notification delivered (`mail.sent.founder`). The admin UI was built and type-checked; it has **not** been clicked through with a signed-in admin (needs your allowlisted email + OTP). Real assessments need credits.

**Next step.** Sign in at `/supadmin/lab` on the preview, open the two mock sessions, try "Book a call" → draft → send (the send will go to `idea-lab-demo` plus-address of your inbox).

## Checkpoint 3 — Experience

**Built.** Voice: three provider adapters + transcribe route + browser dictation fallback; comparison doc + bench script. Resume page, delete-my-data flow, print/PDF brief page, progress rail, retry-without-losing-transcript, busy-lock handling, budget warning, language switch mid-session, finish-early. Screenshot script for iPhone 13 + desktop in AR/EN.

**Tested.** Screenshots in `checkpoint-3/` (dark scheme, reduced motion, iPhone 13 + desktop, EN + AR: landing, resume, delete-my-data, interview). Session hydration now fails loudly with a Retry instead of a spinner when the network drops (found by the screenshot run through the sandbox proxy). Voice adapters are typed and shaped after each vendor's documented API but **not executed** (no keys). The Web Speech fallback is the same mechanism the admin Prompt Maker already uses.

**Untested.** Real-phone walkthrough; provider transcription accuracy (bench needs keys and clips).

## Checkpoint 4 — Quality gate

**Built.** Persona harness (30 personas), judge prompt, preview-only harness endpoint, review-round exporter, retention/sweep/spend cron jobs, cron auth hardening, delete-my-data flow, adversarial unit tests.

**Tested.** Harness plumbing run with the mock provider on the preview: 3 personas completed start → 8 turns → submit → assessment → judge → report (`harness-mock/REPORT.md`; all three "FAIL" on `ladder_ok` because the mock visitor never reacts to ladder steps — expected, and a useful proof that the checks are real). Cron tasks are wired in `vercel.json` and unit-covered where pure; the retention job has **not** run against real data yet (first scheduled run happens after the production deploy).

**Untested.** Everything that needs the real model (see `QUALITY_GATE_REPORT.md` §3) and the founder review round.

See `QUALITY_GATE_REPORT.md` for the sign-off table.
