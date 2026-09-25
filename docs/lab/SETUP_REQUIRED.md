# Idea Lab — one-time setup (everything a human must do, in one place)

Two items block real conversations today; everything else is optional with a graceful fallback.

## Blocking (found by the end-to-end run on the preview)

1. **Anthropic API credits — none left.** Every model call returned `Your credit balance is too low to access the Anthropic API`. Go to https://console.anthropic.com → Plans & Billing → add credits (or enable auto-reload). Nothing else needs to change; the Lab uses the existing `ANTHROPIC_API_KEY`.

## Parked by decision (not needed now)

- **Visitor emails (SES).** SES is in the sandbox, so magic-link and brief-copy emails to visitors are refused (`MessageRejected 400`); the founder notification to your own address is delivered. Decision: leave it. The Lab works fully in the same browser session; "resume on another device" and "copy of the brief by email" switch on by themselves the day SES gets production access (AWS console → SES → Request production access). Nothing else to change.

## Already done for you (no action)

| Item | Where | Status |
|---|---|---|
| Database migration `0006_idea_lab` (+ `lab_orphan_visitors`) | Supabase project `stryvia-ai-website` | applied |
| `LAB_COOKIE_SECRET` (generated) | Vercel → Environment Variables (prod + preview) | set |
| `CRON_SECRET` (generated; also closes the open `/api/cron` endpoint) | Vercel | set |
| `LAB_TURNSTILE_DISABLED=true` (temporary, explicit) | Vercel | set — remove after step 3 |
| `LAB_ENABLED=true` | Vercel | set |
| `LAB_AI_PROVIDER=anthropic` (preview) | Vercel | set |
| Cron jobs `lab_sweep` (hourly), `lab_spend_alert` (hourly), `lab_retention` (daily) | `vercel.json` | active after the next production deploy |

## Human-only steps (optional; each has a fallback)

3. **Bot protection — Cloudflare Turnstile** (recommended before public launch)
   - dash.cloudflare.com → Turnstile → Add site → domain `stryvia.ai` (add `www.stryvia.ai`), widget mode *Managed*.
   - Vercel → Project `stryvia-ai-website` → Settings → Environment Variables:
     - Key `NEXT_PUBLIC_TURNSTILE_SITE_KEY` · Value: the *Site Key*
     - Key `TURNSTILE_SECRET_KEY` · Value: the *Secret Key* (mark Sensitive)
   - Delete the variable `LAB_TURNSTILE_DISABLED`. Redeploy.
   - Until then: rate limits (per IP and per email) and a honeypot protect the start form; `/api/health` shows `botProtection:false`.

4. **Voice transcription provider** (optional; without it the mic button uses the browser's own dictation)
   - Read `docs/lab/VOICE_PROVIDER_COMPARISON.md`, pick a provider, then in Vercel:
     - `LAB_STT_PROVIDER` = `elevenlabs` | `openai` | `azure`
     - plus `ELEVENLABS_API_KEY`, or `OPENAI_API_KEY`, or `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (Sensitive).
   - Then run the real-sample benchmark once: `npm run lab:stt-bench` (keys in `.env.local`, clips in `scripts/lab/stt-samples/`).

5. **Scheduling link** for "Book a call" emails: `LAB_SCHEDULING_URL` = your Calendly / Cal.com booking URL.

6. **WhatsApp ping on priority verdicts** (optional): needs the existing `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` (Meta Cloud API) and `LAB_NOTIFY_WHATSAPP_TO` = your number in E.164 (e.g. `+9665XXXXXXXX`).

7. **Notification inbox** (optional): defaults to `LEAD_NOTIFY_TO`. Set `LAB_NOTIFY_TO` to use a different inbox.

8. **Decision controls** (optional, recommended):
   - `LAB_REVIEWER_EMAILS` = the email(s) allowed to record or send a decision (comma-separated, subset of `ADMIN_EMAIL_ALLOWLIST`). Unset means every allowlisted admin may decide.
   - `LAB_RESPONSE_DAYS` = a number of working days **only if you approve making that promise**. Unset (the default) means the confirmation screen and the brief copy email make no response-time commitment. The earlier "7 working days" default was removed.

8b. **Privacy page draft notice**: `/privacy` still carries "Draft for review … to be reviewed by counsel". It was deliberately left in place: removing the label is a legal sign-off, not a code change. Once counsel has reviewed, delete the `privacy.draftNote` keys in `src/messages/{en,ar}.pages.json`.

9. **Vercel function duration**: Project → Settings → Functions: confirm Fluid compute is on (or the plan allows ≥120 s). The brief and assessment routes declare `maxDuration = 120`.

10. **Legal review**: the consent wording (`src/messages/{en,ar}.pages.json` → `lab.consent`) is PDPL-aware but not legal advice. If counsel changes it, bump `LAB_CONSENT_VERSION` in `src/config/lab.config.ts` and the matching `lab.consent.version` keys.

11. **Persona harness on the preview** (optional, costs API credits): set `LAB_HARNESS_ENABLED=true` on the *preview* environment only, then `BASE_URL=<preview> CRON_SECRET=<value> npm run lab:personas -- --limit 5`.

## Local development

```
cp .env.example .env.local   # fill Supabase + Anthropic keys
npm install
npm run dev                  # http://localhost:3000/lab
npm test                     # unit + repo-guard tests (offline, mock AI)
LAB_AI_PROVIDER=mock npm run dev   # no Anthropic spend while building UI
```
