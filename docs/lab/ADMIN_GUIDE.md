# Idea Lab — reviewing submissions

Everything a visitor gives the Lab lands in one place: **https://www.stryvia.ai/supadmin/lab**. (`/admin/lab` redirects there.) It is the same admin as the rest of the site, so you sign in the same way: enter your allowlisted email, type the 6-digit code from the email, and open the **Idea Lab** tab in the top bar.

Visitors never see any of this. The only things a visitor ever receives are their own brief copy and an email you explicitly send from the decision panel.

## The list

Every session, newest and highest-scoring first. Use the view switch at the top:

| View | What it shows |
|---|---|
| All | Every session, including ones still in progress |
| Needs decision | Submitted briefs with no decision yet (this is your inbox) |
| In progress | Visitors still talking to the AI, with the phase they reached |
| Decided | Sessions where you booked a call, asked for quote details, declined or put on hold |

Each row carries: score and verdict, name, company and role, email (click to mail) and phone (click to open WhatsApp), industry, language, country, turns, model cost, submitted or started date, status.

Filters: search by name/email/company, verdict, industry, language, status, time window. **Export CSV** downloads exactly the rows on screen (UTF-8 with BOM, so Excel shows Arabic correctly) with every contact and outcome column plus the admin link for each row.

## One submission

Click a name. The page has:

- **Header**: contact card (email, WhatsApp link, country, company, role, industry), started/submitted times, consent version, the verdict with weighted score and confidence, and the five "why" lines from the assessor.
- **Decision panel** (right): Book a call · Request quote details · Polite decline · Mark on hold. The first three draft an email in the visitor's language; you edit it in the box, optionally ask for a redraft with a hint, then press **Send to visitor**. Nothing goes out until that click. Below: export the review packet (Markdown), print it to PDF, re-run the assessment, or delete all of the visitor's data.
- **Brief** tab: the visitor's brief as they approved it (both parts, plus what they bring and expect).
- **Scorecard** tab: the seven rubric dimensions with the assessor's note and quoted evidence, triggered red flags, the reasoning, and the AI's proposed plan (internal only).
- **Transcript** tab: the full conversation, voice turns marked, guardrail hits flagged.
- **State** tab: the 18 slots with confidence bars, the industry lens, and the rolling summary.
- **Side**: decision history (including sent emails) and your private notes.

## Where the data lives

Supabase project `stryvia-ai-website`, tables prefixed `lab_` (sessions, messages, idea_state, briefs, assessments, decisions, admin_notes, events, ai_calls). Row Level Security is enabled with no public policies; only the server reads them. Sessions are hard-deleted 12 months after last activity by the daily retention job, or immediately when a visitor uses "delete my data" or you press delete.

## Notifications

Every submission emails the founder inbox (`LAB_NOTIFY_TO`, defaulting to `LEAD_NOTIFY_TO`) with the verdict, score, why-lines and a link to the detail page. Priority verdicts also go to WhatsApp once `LAB_NOTIFY_WHATSAPP_TO` is set.
