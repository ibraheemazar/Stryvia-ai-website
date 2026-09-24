# Idea Lab — one-time setup (everything a human must do, in one place)

The Lab works on day one with what is already configured (Anthropic key, Supabase, SES, admin allowlist). The items below unlock optional capabilities or remove temporary flags. Each one has a graceful fallback; nothing here blocks the text flow.

## Already done for you (no action)

| Item | Where | Status |
|---|---|---|
| Database migration `0006_idea_lab` | Supabase project `stryvia-ai-website` | applied |
| `LAB_COOKIE_SECRET` (generated) | Vercel → Environment Variables (prod + preview) | set |
| `CRON_SECRET` (generated; also closes the open `/api/cron` endpoint) | Vercel | set |
| `LAB_TURNSTILE_DISABLED=true` (temporary, explicit) | Vercel | set — remove after step 1 |
| `LAB_ENABLED=true` | Vercel | set |

## Human-only steps

1. **Bot protection — Cloudflare Turnstile** (recommended before public launch)
   - dash.cloudflare.com → Turnstile → Add site → domain `stryvia.ai` (add `www.stryvia.ai`), widget mode *Managed*.
   - Vercel → Project `stryvia-ai-website` → Settings → Environment Variables:
     - Key `NEXT_PUBLIC_TURNSTILE_SITE_KEY` · Value: the *Site Key*
     - Key `TURNSTILE_SECRET_KEY` · Value: the *Secret Key* (mark Sensitive)
   - Delete the variable `LAB_TURNSTILE_DISABLED`. Redeploy.
   - Until then: rate limits (per IP and per email) and a honeypot protect the start form; `/api/health` shows `botProtection:false`.

2. **Voice transcription provider** (optional; without it the mic button uses the browser's own dictation)
   - Read `docs/lab/VOICE_PROVIDER_COMPARISON.md`, pick a provider, then in Vercel:
     - `LAB_STT_PROVIDER` = `elevenlabs` | `openai` | `azure`
     - plus `ELEVENLABS_API_KEY`, or `OPENAI_API_KEY`, or `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (Sensitive).
   - Then run the real-sample benchmark once: `npm run lab:stt-bench` (needs the keys locally in `.env.local`).

3. **Scheduling link** for "Book a call" emails
   - `LAB_SCHEDULING_URL` = your Calendly / Cal.com booking URL.

4. **WhatsApp ping on priority verdicts** (optional)
   - Needs the existing `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` (Meta Cloud API) and
   - `LAB_NOTIFY_WHATSAPP_TO` = your number in E.164 (e.g. `+9665XXXXXXXX`).

5. **Founder notification address** (optional)
   - Defaults to `LEAD_NOTIFY_TO`. Set `LAB_NOTIFY_TO` to use a different inbox.

6. **SES deliverability check** (5 minutes, prevents magic links landing in spam)
   - AWS SES console → verify the sending domain has DKIM enabled and the account is out of the sandbox; add a DMARC record (`v=DMARC1; p=quarantine; rua=mailto:…`) if missing.

7. **Vercel function duration**
   - Project → Settings → Functions: confirm Fluid compute is on (or the plan allows ≥120 s). The brief and assessment routes declare `maxDuration = 120`.

8. **Legal review**
   - The consent and privacy wording (`src/messages/{en,ar}.pages.json` → `lab.consent`) is PDPL-aware but not legal advice. Have counsel review before public launch. Bump `LAB_CONSENT_VERSION` in `src/config/lab.config.ts` and the matching `lab.consent.version` key if the wording changes.

## Local development

```
cp .env.example .env.local   # fill Supabase + Anthropic keys
npm install
npm run dev                  # http://localhost:3000/lab
npm test                     # unit + repo-guard tests (offline, mock AI)
LAB_AI_PROVIDER=mock npm run dev   # no Anthropic spend while building UI
```
