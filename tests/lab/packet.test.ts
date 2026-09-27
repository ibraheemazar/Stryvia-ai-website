import { describe, expect, it } from "vitest";
import { packetHtml, packetMarkdown } from "@/lib/lab/packet";
import type { SessionDetail } from "@/lib/lab/admin";

const detail = {
  session: {
    id: "11111111-2222-3333-4444-555555555555",
    visitor_id: "v",
    visitor_name: "نورة العلي",
    email: "nora@example.com",
    phone_e164: "+966500000000",
    country: "SA",
    company: "مكتب الأمانة للترجمة",
    role: "Owner",
    language: "ar",
    status: "submitted",
    phase: "done",
    consent_version: "2026-09-v1",
    consent_at: "2026-09-24T10:00:00Z",
    prompt_version: "2026-09-24.1",
    rubric_version: "2026-09-v1",
    token_usage: { input: 1000, output: 500, cache_read: 0, cache_write: 0, cost_usd: 0.123 },
    turn_count: 12,
    turns_in_phase: 0,
    strikes: 0,
    finish_nudged: false,
    pending_turn_id: null,
    pending_started_at: null,
    assessment_status: "done",
    first_message_at: "2026-09-24T10:01:00Z",
    last_active_at: "2026-09-24T10:20:00Z",
    submitted_at: "2026-09-24T10:20:00Z",
    created_at: "2026-09-24T10:00:00Z",
    updated_at: "2026-09-24T10:20:00Z",
  },
  messages: [
    { id: "m1", session_id: "s", turn_index: 1, role: "user", content: "الطلبات تأتي عبر WhatsApp | يدويًا", input_mode: "voice", transcript_raw: "الطلبات تاتي عبر واتساب", model: null, usage: null, guardrail_hits: null, created_at: "2026-09-24T10:01:00Z" },
    { id: "m2", session_id: "s", turn_index: 1, role: "assistant", content: "فهمت. كم طلبًا شهريًا؟", input_mode: "text", transcript_raw: null, model: "interview", usage: null, guardrail_hits: null, created_at: "2026-09-24T10:01:30Z" },
  ],
  state: {
    session_id: "s",
    slots: {
      problem: { value: "تسعير يدوي", confidence: 0.9, evidence: [], updated_turn: 1 },
      industry: { value: "translation services", confidence: 0.9, evidence: [], updated_turn: 1 },
      expansion_reactions: { automate: { reaction: "excited", quote: "نعم", turn_id: null }, intelligence: null, productize: null, scale: null },
    },
    industry_lens: null,
    rolling_summary: null,
    summarised_through_turn: 0,
    updated_at: "2026-09-24T10:20:00Z",
  },
  brief: {
    id: "b",
    session_id: "s",
    version: 2,
    language: "ar",
    visitor_edited: true,
    kind: "edited",
    source_version: 1,
    rendered_html: "<html></html>",
    created_at: "2026-09-24T10:19:00Z",
    content: {
      title: "مكتب ترجمة أسرع",
      one_line: "x",
      what_you_came_with: { problem: "p", who_is_affected: "w", current_process: ["a", "b"], frequency_and_volume: "f", cost_today: "c", tried_so_far: "t", tools: "WhatsApp", desired_outcome: "d" },
      what_it_could_become: { intro: "i", automate: "a", add_intelligence: "b", productize: "c", scale: "d", honest_ceiling_note: "e" },
      what_you_bring: ["خبرة"],
      what_you_expect: "شراكة",
      constraints: "لا شيء",
      scope: { confirmed: [], excluded: [], assumptions: [], open_questions: [] },
      next_step_note: "n",
    },
  },
  assessment: {
    id: "a",
    session_id: "s",
    rubric_version: "2026-09-v1",
    prompt_version: "2026-09-24.1",
    model: "claude-opus-5-5",
    scores: Object.fromEntries(["market_repeatability", "pain_intensity", "stryvia_fit", "effort_vs_value", "person_contribution", "deal_alignment", "founder_signal"].map((k) => [k, { score: 4, evidence: ["quote | with pipe"], note: "note" }])),
    red_flags: [{ id: "no_decision_maker_access", triggered: true, evidence: "cannot sign" }],
    verdict: "priority_call",
    model_verdict: "productize",
    weighted_score: 4.1,
    confidence: 0.8,
    reasoning: "Strong.",
    why_lines: ["one", "two", "three", "four", "five"],
    proposed_plan: { what_stryvia_could_build: "intake tool", rough_scope: "small", suggested_deal_shape: "hybrid", open_questions: ["q1"] },
    manipulation_detected: false,
    actor: "system",
    created_at: "2026-09-24T10:21:00Z",
  },
  assessments: [],
  briefVersions: [
    { version: 1, language: "en", kind: "generated", source_version: null, created_at: "2026-09-24T10:18:00Z" },
    { version: 2, language: "ar", kind: "edited", source_version: 1, created_at: "2026-09-24T10:19:00Z" },
  ],
  decisions: [{ id: "d", session_id: "s", decision: "hold", notes: "later", decided_by: "reviewer@stryvia.ai", decided_at: "2026-09-24T11:00:00Z", outbound_email_subject: null, outbound_email_body: null, outbound_email_sent_at: null }],
  notes: [{ id: "n", session_id: "s", author: "reviewer@stryvia.ai", body: "call next week", created_at: "2026-09-24T11:01:00Z" }],
} as unknown as SessionDetail;

describe("review packet", () => {
  it("markdown contains every required section (§8)", () => {
    const md = packetMarkdown(detail);
    for (const h of ["## Contact", "## AI triage (internal suggestion — not a decision)", "## Scorecard", "## Red flags", "## AI's proposed plan (internal)", "## Brief", "## Slot state", "## Decisions and notes", "## Transcript"]) {
      expect(md).toContain(h);
    }
    // The packet never presents the AI's triage as a verdict or a decision.
    expect(md).not.toMatch(/## Verdict|approved|rejected/);
    expect(md).toContain("v2 edited ar");
    expect(md).toContain("+966500000000");
    expect(md).toContain("Priority call");
    expect(md).toContain("model suggested `productize`");
    expect(md).toContain("No decision-maker access");
    expect(md).toContain("VISITOR (voice)");
    expect(md).toContain("_raw transcript:_");
    expect(md).toContain("quote / with pipe"); // pipes escaped inside tables
    expect(md).toContain("ladder · automate");
  });

  it("html escapes content and marks user text as bidi-auto", () => {
    const html = packetHtml(detail);
    expect(html).toContain("<table>");
    expect(html).toContain('dir="auto"');
    expect(html).toContain("window.print()");
    expect(html).not.toContain("<script");
  });
});
