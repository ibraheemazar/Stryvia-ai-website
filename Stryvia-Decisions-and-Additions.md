# Stryvia.ai — Decisions and additions

This document records the decisions you confirmed and specifies the new scope they created. It sits on top of the specification, the build package, and the launch brief, and overrides them wherever they differ.

---

## 1. Locked decisions

1. Universal intelligence. Stryvia works for any domain, any industry, any person. There is no finite list of domains to define or wait for.
2. Languages. The site ships in English and Arabic at launch, with French added later. Built trilingual-ready from day one.
3. Fonts. Open-source families, locked: Bricolage Grotesque for display, Hanken Grotesk for body, JetBrains Mono for the instrument layer, IBM Plex Sans Arabic for Arabic. The Latin fonts also cover French.
4. Anthropic key, domain, hosting. You provide the API key in Claude Code; the domain is yours on GoDaddy and points later; Vercel is ready.
5. Admin and leads. A backend admin dashboard is required, showing converted leads and all conversations including those that did not convert, so you can understand what clients ask for. Converted leads also notify you immediately. Specified in section 5.
6. Analytics. Full behavioral analytics, my recommendation to follow. Specified in section 6.
7. The close is manual. The Chat shows real capability before the handoff; a human closes. Specified in section 4.
8. Investor page live at launch, written in section 9.
9. Privacy policy drafted, delivered as a separate file.
10. Data handling, my call, specified in section 7.

---

## 2. Universal positioning, and what it changes

"The intelligence works for all" is now the spine, and it changes how breadth is presented. The capability pages and the industry pages are no longer a catalog that implies a boundary. They are illustrative entry points into one universal capability, and the site says "whatever you bring" rather than "here is our list." The architecture must make breadth feel infinite, not enumerated.

Concretely. The capabilities and industries become open, expandable example sets, each built from the templates in the build package, added to over time, never framed as the full extent of what Stryvia does. The homepage expanse scene, the problem gallery, and the examples carry the "anything" feeling through variety, not through a finite menu. The intelligence page stays simple, as you said: the Brain is the thing that lets you do anything. No heavy architecture diagram on the public site; the depth stays internal.

This closes the open item that was waiting on a domain document. Nothing is now waiting on it.

The one place this needs care is the investor page, where "we do anything" can read as unfocused. That is handled in section 9.

---

## 3. Languages and fonts

Build with internationalization for three locales from the start: English and Arabic populated at launch, French added later without re-engineering. Arabic is full right-to-left, mirrored layout, mirrored bracket device, with the Arabic font, built using logical CSS properties so the mirror is automatic. Arabic is native and idiomatic for the Gulf, never a literal translation, and the Chat replies in the visitor's language. The language switcher is persistent. Fonts are the open-source set in section 1; self-host them, preload display and body.

---

## 4. The Chat shows muscle before the handoff

The close is manual, so the Chat's job is to make the visitor want that call by demonstrating real capability, not just scoping politely. This is a tuning of the system prompt in the build package, Part B. Add the following behavior:

After understanding the problem, the Chat does not only describe an approach. It shows a genuine, concrete taste of the thinking, enough to make the visitor feel the depth and go "they can really do this." A vivid, specific first move on their actual problem. A sharp insight they had not considered. A concrete fragment of the solution, a structure, an outline, a first draft of one piece, a clear plan. Real muscle, not a sales line. It stops short of delivering the whole thing, because the full build happens in the engagement, but it gives enough that the value is undeniable before the human ever speaks.

Insert into the Part B prompt, in the scoping section: "Before you invite the next step, show real capability on their actual problem. Give a concrete, specific taste: a sharp insight, a first structure, a draft of one piece, something they can see and feel the quality of. Make the value undeniable. Then stop short of the full deliverable and invite them to build it together." Keep all existing guardrails; the muscle is a genuine taste, never the finished work, never an overpromise.

---

## 5. The admin dashboard and backend

Purpose: one place where you see every lead and every conversation, including the ones that did not convert, so you understand what people want and what they say. This is both your sales inbox and your customer-intelligence tool.

Recommended stack: Supabase, Postgres plus Auth, which fits the rest of the build and gives you a database, authentication, and region selection in one. The site reads and writes conversations through server routes; the admin is an authenticated area of the same app.

Data model:

```
conversations
  id, created_at, updated_at, locale, page_context,
  status (active | scoped | converted | escalated | abandoned),
  problem_category, summary, converted (bool)

messages
  id, conversation_id, role (user | assistant), content, created_at

leads
  id, conversation_id, name, email, company (nullable),
  created_at, status (new | contacted | closed | lost), notes
```

Every conversation is stored, converted or not, with its full transcript, the language, the page it started on, a short auto-generated summary, and a problem category the Chat tags at the end. When a visitor converts, a lead row is created and you are notified by email immediately.

Dashboard views:

- Inbox. Converted leads, newest first, each showing contact details, the full conversation, the auto summary, and an editable status and notes so you can track the manual close.
- All conversations. Every conversation including non-converted, filterable by category, language, date, and status, and full-text searchable, so you can read what people are actually asking for.
- Insights. The top problem categories, the most common asks, the conversion rate, and where conversations drop off, so the site teaches you what to build and sell next.
- Conversation detail. The full transcript for any conversation, with its metadata.

Access: a single admin login to start, Supabase Auth with an email allowlist, expandable to a small team later. Notifications: converted leads trigger an email to you; optionally a daily digest of non-converted conversations worth reading.

---

## 6. Analytics

Recommendation: PostHog as the core, for product and behavioral analytics, funnels, session replay, and dashboards, with Vercel's built-in analytics for basic web vitals. PostHog gives you the full views you asked for, is privacy-configurable, and pairs with the admin dashboard, which already gives you conversation-level intelligence that generic analytics cannot.

The events to track, which together form the funnel:

```
page_view
language_switched
chat_opened
chat_first_message          (the real top of funnel)
chat_scope_returned
chat_muscle_shown
chat_cta_shown
lead_started
lead_submitted              (conversion)
early_access_submitted
chat_escalated_to_human
capability_viewed
industry_viewed
scenario_viewed
```

The core funnel to watch: visit, then chat_first_message, then chat_scope_returned, then lead_submitted. The drop between any two steps tells you exactly where to improve. Add session replay with the lead form fields masked so you never record personal details. Build three dashboards: the funnel, the content (which capabilities, industries, and scenarios pull attention), and language (English versus Arabic behavior). A cookie and consent notice is required for analytics; it is covered in the privacy policy.

---

## 7. Lead flow and data handling

Lead flow: a visitor converts in the Chat, the conversation and contact details write to Supabase as a lead, you receive an email immediately and see it in the Inbox, and you close manually, updating the lead's status and notes as you go. Non-converted conversations remain in All conversations for you to learn from.

Data handling, my recommendation. Store conversations and leads in Supabase with encryption at rest, which is on by default, and TLS in transit. Restrict the admin to your authenticated account. Choose the Supabase and Vercel regions closest to your users; verify at build time which regions are available nearest the Kingdom, and select the nearest in-region option. Keep a simple retention and deletion practice so you can honor a person's request to be forgotten, which the Kingdom's data protection law expects.

The honesty point, important. The Trust page claims data stays in the region. That claim must match the region you actually select. If a true in-Kingdom region is available, use it and the claim stands. If the nearest available region at launch is outside the Kingdom, soften the Trust copy to the truth, for example that data is encrypted and handled to strict standards and stored in the nearest available region, with in-Kingdom hosting as the platform grows. Do not let the copy promise more than the infrastructure delivers. This is a verification step for the developer and a copy adjustment if needed, not a blocker.

This is a sensible default, not legal advice. The privacy policy is a starting draft and should be reviewed by counsel familiar with the Kingdom's data protection law before launch.

---

## 8. Starter scenarios

A first set, written in present possibility, spanning the breadth so the universal positioning is shown rather than claimed. Each follows the scenario template. Use these at launch and grow the set over time.

1. You have a product in your head and no team to build it. You describe what you want to exist, you make the calls on what it should be, and it gets built with you, an interface, the logic, the thing working, yours to own and change. Shape: weeks, not months. You own all of it.

2. You want to open a business in a field you do not know yet. You bring the idea. You get the market read, the model, the brand, the plan, and the first steps, in language you understand, shaped to your situation, so you can decide and move without hiring a row of consultants first. Shape: a clear plan in days, the build that follows scoped with you.

3. You need a campaign across several platforms at once. You set the intent and the message. You get the concept, the assets, and the variations across formats and languages, coherent because the work was orchestrated as one, not stitched from five tools. Shape: a full campaign in a fraction of the usual time. Yours to run.

4. Your team is drowning in a manual process. You describe the workflow and where it hurts. You get it mapped, redesigned, and automated, with you deciding what stays in human hands. Shape: weeks to a working automation. You own and control it.

5. You are raising and need the story and the numbers. You bring the business. You get the model, the thesis, and the deck, built to hold up under scrutiny, in your voice, with you directing what it argues. Shape: a tight, defensible package, fast. Yours.

6. You want a tool your team uses every day, a CRM or an internal system shaped to how you actually work. You describe how your team works. You get a system built to fit, not a generic product you bend yourself around. Shape: weeks to something real. You own it.

7. You are entering a new market. You bring the ambition. You get the research, the localization, and the go-to-market, built for that market specifically, with you steering. Shape: a real plan and the assets to start, quickly. Yours.

8. You have an idea you have carried for years and never built. You finally describe it. The intelligence helps you shape it and bring it into existence, with you as the author the whole way. Shape: from idea to something real, at last. Entirely yours.

---

## 9. The investor page

Live at launch, gated behind a short email capture. Written to make the universal positioning the strength, not the doubt. The content:

The shift. The market is moving from AI tools that do one thing to AI capability that does the work. Tools have hit their ceiling. The next layer is an intelligence that takes a problem and produces the solution, across any domain. That layer is open, and Stryvia is building it.

What Stryvia is. The intelligence you build with. A person brings a problem, directs the work, and owns the result, while the intelligence does the heavy lifting, on any kind of problem. Not a vertical tool and not a services firm. Infrastructure for capability itself.

The moat, and why universal is a strength. The defensibility is not the underlying models, which everyone can rent. It is the proprietary thinking model that approaches any problem in structured layers, the orchestration that makes many models work as one to produce results no single tool can, and the compounding base of solved problems that deepens the reasoning over time. Because the moat is the method, not a niche, it generalizes across every domain. That is precisely why the reach is universal: the same engine that solves one kind of problem solves the next. Breadth is not a lack of focus; it is what a method-based moat produces.

Why now. Models became good enough to reason inside a problem only recently, and orchestrating many of them into one coherent result became practical only recently. The window to build the capability layer is open now and was not open before.

The market. The addressable market is not a category, it is the cost of capability itself: every company and every founder who currently hires, contracts, or waits to get work done. Horizontal reach against a problem every business has.

Why here. Built in the region, anchored in it, with capability and data kept close to home, aligned with where the region is deliberately heading. A credible local champion in a moment when local capability is being actively backed.

The invitation. Not a raise pitch, a statement. For investors who want exposure to the capability layer, a conversation.

---

## 10. What this changes in the existing documents

The specification: capabilities and industries are illustrative, not a catalog; the intelligence page stays simple; the domain open item is closed; trilingual replaces the bilingual question.

The build package: fonts locked to the open set; the Chat prompt gains the "show muscle" behavior in Part B; the technical part gains Supabase for storage and the admin, PostHog for analytics, and the lead-to-admin flow; design tokens and components are unchanged.

The launch brief: the admin dashboard and analytics join Tier 1, because you need to see leads and conversations from day one; the investor page is confirmed Tier 1; the interactive components stay Tier 3.

---

## 11. Nothing is blocking

There are no further inputs needed from you to begin. At the point the build goes live, the only wiring required is the Anthropic key, the domain pointing, and selecting the hosting and database regions. Everything else is decided and specified.
