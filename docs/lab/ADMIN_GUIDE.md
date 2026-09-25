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

Each row carries: the AI triage (an internal suggestion, never a decision), name, company and role, email (click to mail) and phone (click to open WhatsApp), industry, language, country, turns, model cost, submitted or started date, status.

Filters: search by name/email/company, triage, industry, language, status, time window. **Export CSV** downloads exactly the rows on screen (UTF-8 with BOM, so Excel shows Arabic correctly) with every contact and outcome column plus the admin link for each row.

## One submission

Click a name. The page has:

- **Header**: contact card (email, WhatsApp link, country, company, role, industry), started/submitted times, consent version, the AI triage with its weighted score and confidence (labelled as a suggestion), the TEST DATA / NO CONTACT badges when set, and the five "why" lines from the assessor.
- **Decision panel** (right): Book a call · Request quote details · Polite decline · Mark on hold. The first three draft an email in the visitor's language; you edit it in the box, optionally ask for a redraft with a hint, then press **Preview exact email**. The preview shows the exact email (to, subject, rendered body) and only then offers **Confirm and send**. Nothing goes out before that second click. Below: export the review packet (Markdown), print it to PDF, re-run the AI triage, or delete all of the visitor's data.
- **Badges**: `TEST DATA` means the visitor said the session is a test or fictional; `NO CONTACT` means they asked not to be contacted. Both are set from the visitor's own words during the conversation and stored on the session, outside any generated text, so no translation or revision can remove them. Sending to a `NO CONTACT` visitor is refused unless you tick the explicit override in the confirm dialog.
- **Brief versions**: the brief shown is the exact version the visitor submitted (stamped "Version N · submitted version"). The history below it lists every version with its kind (generated / edited by the visitor / translated / AI revision), its language and the version it was made from.

## Files the visitor sends

Everything a visitor sends is kept: every message (text and the raw voice transcript), every file they attach with the paperclip button, and every voice recording that reaches Stryvia's transcription service. Files are stored in the private Supabase bucket `lab-attachments` (no public access; only the server can read it). On the detail page, **Files sent by the visitor** lists each one with its original name, size, type and time, plus a download link that stays valid for an hour (reload the page for fresh links). The transcript line for the message says which files came with it. The review packet lists them too.

Accepted: documents, images, spreadsheets, slides, audio, video and archives, up to 50 MB per file, 10 per message and 40 (500 MB) per session. Refused: executables and scripts (`.exe`, `.sh`, `.js`, `.apk`, …), because they could harm whoever opens them. When voice uses the browser's own dictation (the default until a transcription key is set), no audio reaches Stryvia at all, so only the text is kept; recordings are kept once `LAB_STT_PROVIDER` is set to a server provider.

The AI does not read attached files. It sees only that a file was attached (its name), so nothing in a file can change what the AI says. Deleting a session (visitor "delete my data", admin delete, or the 12-month retention job) deletes its files too.

## What the AI does and does not do

The AI gathers, clarifies and organises. The "AI triage" block is an internal suggestion to help you order your reading; it is never shown to the visitor, never changes a session's status, and never sends anything. Every submitted brief lands in **Awaiting manual review** and stays there until *you* record a decision. Recording a decision and communicating it are two separate actions, both audited with your email:

| Action | What happens | Who can do it |
|---|---|---|
| Mark on hold | Records `hold`; nothing is sent | An authorised reviewer, after an explicit confirmation |
| Book a call / Request quote details / Polite decline → Preview | Renders the email; nothing is sent, nothing is recorded | An authorised reviewer |
| → Confirm and send | Sends the previewed email and records the decision with the sent text | An authorised reviewer, after the confirm dialog |

"Authorised reviewer" is every allowlisted admin by default. To narrow it to yourself (or a named few), set `LAB_REVIEWER_EMAILS` (comma-separated) in Vercel; other admins can then read everything but get *"not a reviewer"* when they try to decide or send. Visitor-facing routes, the AI pipeline and the scheduled jobs cannot reach the decision table at all (a repo-guard test enforces this).

## Response-time promise

The Lab makes no response-time promise unless you set `LAB_RESPONSE_DAYS` (a number of working days) in Vercel. When set, the confirmation screen and the visitor's brief copy say "Stryvia aims to respond within N working days"; when unset they say only that the brief is awaiting manual review and no decision has been made.
- **Brief** tab: the visitor's brief as they approved it (both parts, plus what they bring and expect).
- **Scorecard** tab: the seven rubric dimensions with the assessor's note and quoted evidence, triggered red flags, the reasoning, and the AI's proposed plan (internal only).
- **Transcript** tab: the full conversation, voice turns marked, guardrail hits flagged.
- **State** tab: the 18 slots with confidence bars, the industry lens, and the rolling summary.
- **Side**: decision history (including sent emails) and your private notes.

## Where the data lives

Supabase project `stryvia-ai-website`, tables prefixed `lab_` (sessions, messages, idea_state, briefs, assessments, decisions, admin_notes, events, ai_calls). Row Level Security is enabled with no public policies; only the server reads them. Sessions are hard-deleted 12 months after last activity by the daily retention job, or immediately when a visitor uses "delete my data" or you press delete.

## Notifications

Every submission emails the founder inbox (`LAB_NOTIFY_TO`, defaulting to `LEAD_NOTIFY_TO`) with the AI triage (clearly labelled as a suggestion, not a decision), the flags, the why-lines and a link to the detail page; it states that nothing has been decided and nothing has been sent to the visitor. High-priority triage also goes to WhatsApp once `LAB_NOTIFY_WHATSAPP_TO` is set.
