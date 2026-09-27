import "server-only";
import type { z } from "zod";
import { LabAiError, type LabAiProvider, type StructuredCall, type StreamCall, type StreamResult, type Usage } from "./ai";

// Deterministic mock provider for CI and e2e (plan §1.10). It speaks the same
// interfaces and produces schema-valid shapes so the REAL phase controller,
// merge logic and rendering run end to end. It proves plumbing, not AI
// quality, and is refused in production by `getLabAi()`.

const ZERO: Usage = { input: 120, output: 80, cacheRead: 0, cacheWrite: 0, costUsd: 0.001 };

function lastUser(call: { messages: Array<{ role: string; content: unknown }> }): string {
  const m = [...call.messages].reverse().find((x) => x.role === "user");
  if (!m) return "";
  return typeof m.content === "string"
    ? m.content
    : (m.content as Array<{ type: string; text?: string }>).map((b) => b.text ?? "").join("\n");
}

function extractField(text: string, label: string): string | null {
  const re = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  const m = re.exec(text);
  return m ? m[1].trim() : null;
}

const SLOT_ORDER = [
  "problem",
  "affected_users",
  "current_process",
  "frequency_and_volume",
  "cost_of_status_quo",
  "attempts_so_far",
  "tools_in_use",
  "desired_outcome",
  "industry",
  "competitors_or_alternatives",
  "what_they_bring",
  "expected_deal_type",
  "budget_range",
  "decision_maker",
  "timeline",
  "constraints_and_regulation",
];

/**
 * The mock extractor fills slots in a fixed order, one or more per visitor
 * message, driven by the message content:
 *   - "fill:<slot>[,<slot>]" fills those slots with the message text
 *   - "ladder:<step>=<reaction>" records a ladder reaction
 *   - "finish" sets wants_to_finish; "abuse" sets abusive; "inject" sets injection_attempt
 *   - otherwise it fills the next 2 unfilled slots listed in CURRENT STATE
 */
function mockExtract(user: string) {
  const latest = user.split("LATEST VISITOR MESSAGE")[1] ?? user;
  const stateBlock = user.split("CURRENT STATE:")[1]?.split("RECENT TURNS:")[0] ?? "";
  const filled = new Set(
    [...stateBlock.matchAll(/^- ([a-z_]+) \(confidence/gm)].map((m) => m[1]),
  );
  const slot_updates: Array<{ slot: string; value: string; confidence: number; evidence: string; retract: boolean }> = [];
  const ladder_reactions: Array<{ step: string; reaction: string; quote: string }> = [];
  const explicit = extractField(latest, "fill");
  // "fill:a,b industry: x" → a, b (anything after the slot list is other directives).
  const targets = explicit
    ? explicit.split(/[\s,]+/).map((s) => s.trim()).filter((s) => SLOT_ORDER.includes(s))
    : SLOT_ORDER.filter((s) => !filled.has(s)).slice(0, 2);
  const isArabic = /[؀-ۿ]/.test(latest);
  for (const slot of targets) {
    if (!SLOT_ORDER.includes(slot)) continue;
    slot_updates.push({
      slot,
      value: isArabic ? `قيمة تجريبية لـ ${slot}` : `mock value for ${slot}`,
      confidence: 0.9,
      evidence: latest.replace(/\s+/g, " ").trim().slice(0, 80),
      retract: false,
    });
  }
  for (const m of latest.matchAll(/ladder:(automate|intelligence|productize|scale)=(excited|interested|neutral|skeptical|rejected)/g)) {
    ladder_reactions.push({ step: m[1], reaction: m[2], quote: m[0] });
  }
  const industryExplicit = extractField(latest, "industry");
  return {
    slot_updates,
    ladder_reactions,
    industry: industryExplicit ?? (filled.has("industry") ? null : "mock industry"),
    industry_confidence: industryExplicit ? 0.95 : filled.has("industry") ? 0 : 0.8,
    language_detected: isArabic ? "ar" : "en",
    signals: {
      wants_to_finish: /\bfinish\b/i.test(latest),
      off_topic: /\bofftopic\b/i.test(latest),
      abusive: /\babuse\b/i.test(latest),
      sensitive_disclosure: /\bsensitive\b/i.test(latest),
      injection_attempt: /\binject\b|ignore (all|your) (previous )?instructions/i.test(latest),
      visitor_is_struggling: /\bstruggl/i.test(latest),
      is_test_or_fictional: /\bfictional\b|\bqa test\b/i.test(latest),
      no_contact_requested: /do not contact|don't contact/i.test(latest),
      demands_decision: /approve .*partnership|skip .*review/i.test(latest),
    },
  };
}

function mockLens(user: string) {
  const industry = extractField(user, "INDUSTRY") ?? "mock industry";
  return {
    industry,
    summary: `Mock lens for ${industry}.`,
    stakeholders: ["owner", "customers", "regulator"],
    regulations_and_licences: ["verify local licensing"],
    data_sensitivity: "personal data of customers",
    money_flows: "customers pay per job",
    incumbent_tools: ["spreadsheets", "WhatsApp"],
    what_scale_looks_like: "a SaaS for peers across the GCC",
    typical_pitfalls: ["underestimating onboarding"],
  };
}

function mockBrief(user: string) {
  const ar = /OUTPUT LANGUAGE: Arabic/.test(user);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  return {
    title: t("Your idea, shaped", "فكرتك، بصياغة أوضح"),
    one_line: t("A mock brief generated by the test provider.", "ملخص تجريبي من مزوّد الاختبار."),
    what_you_came_with: {
      problem: t("Mock problem statement.", "وصف تجريبي للمشكلة."),
      who_is_affected: t("Mock affected users.", "المتأثرون (تجريبي)."),
      current_process: [t("Step one", "الخطوة الأولى"), t("Step two", "الخطوة الثانية")],
      frequency_and_volume: t("Weekly, dozens of cases.", "أسبوعيًا، عشرات الحالات."),
      cost_today: t("Hours lost each week.", "ساعات ضائعة كل أسبوع."),
      tried_so_far: t("Spreadsheets.", "جداول بيانات."),
      tools: t("WhatsApp, Excel.", "واتساب وإكسل."),
      desired_outcome: t("Less manual work.", "عمل يدوي أقل."),
    },
    what_it_could_become: {
      intro: t("Ideas explored together, not commitments.", "أفكار استكشفناها معًا، لا التزامات."),
      automate: t("Automate intake.", "أتمتة الاستلام."),
      add_intelligence: t("AI drafts.", "مسودات بالذكاء الاصطناعي."),
      productize: t("A tool for peers.", "أداة للزملاء في المجال."),
      scale: t("A regional network.", "شبكة إقليمية."),
      honest_ceiling_note: t("The ceiling depends on how many peers share this exact workflow.", "السقف يعتمد على عدد من يشاركونك هذا المسار نفسه."),
    },
    what_you_bring: [t("Domain expertise", "خبرة في المجال")],
    what_you_expect: t("Not decided yet.", "لم يُقرَّر بعد."),
    constraints: t("None discussed.", "لم تُناقش."),
    scope: {
      confirmed: [t("An internal tool first", "أداة داخلية أولًا")],
      excluded: [t("Payments", "المدفوعات")],
      assumptions: [t("AI assumption: the team will keep using WhatsApp", "افتراض من الذكاء الاصطناعي: سيستمر الفريق باستخدام WhatsApp")],
      open_questions: [t("Exact monthly volume is unknown", "الحجم الشهري الدقيق غير معروف")],
    },
    next_step_note: t("Submitted for manual review by Stryvia's team; no decision has been made.", "أُرسل للمراجعة اليدوية من فريق سترايفيا؛ لم يُتَّخذ أي قرار."),
  };
}

// ---- Controlled failure injection (e2e only; the mock never runs in
// production). Driven by the visitor's own text so a test can trigger exactly
// one failure and then recover:
//   - "fail:provider" / "fail:credits" in the latest message: the interviewer
//     stream fails ONCE for that message (provider error / exhausted credits);
//     the retry of the same message succeeds.
//   - "slow:<ms>" in the latest message: the reply is delayed that long, so a
//     refresh mid-turn hits the "still working" path.
//   - "mock:drop-numbers" anywhere in a brief being translated: the mock
//     translation loses every digit, which the fact check must reject.
//   - "mock:wrong-language" in a revision request: the revision comes back in
//     the other script, which the language check must reject.
const failedOnce = new Set<string>();

function injectedFailure(sessionId: string | null, latest: string): "provider" | null {
  const m = /\bfail:(provider|credits)\b/.exec(latest);
  if (!m) return null;
  const key = `${sessionId}:${latest.replace(/\s+/g, " ").trim()}`;
  if (failedOnce.has(key)) return null;
  failedOnce.add(key);
  return "provider";
}

function injectedDelay(latest: string): number {
  const m = /\bslow:(\d{2,5})\b/.exec(latest);
  return m ? Math.min(20_000, Number(m[1])) : 0;
}

function walkStrings(v: unknown, f: (s: string) => string): unknown {
  return typeof v === "string" ? f(v) : Array.isArray(v) ? v.map((x) => walkStrings(x, f)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walkStrings(x, f)])) : v;
}

// Deterministic "translation": a letter-for-letter transliteration into the
// target script that keeps every digit, number word (as a digit) and currency
// mention intact. It reads as the target language to the deterministic script
// check, and the visitor's exact saved text (edits included) is what travels —
// which is the property the real translation is checked for.
const LATIN = "abcdefghijklmnopqrstuvwxyz";
const ARABIC = "ابتثجحخدذرزسشصضطظعغفقكلمنه";
const EN_NUMBER_WORDS: Array<[RegExp, string]> = [[/\btwo\b/gi, "2"], [/\bthree\b/gi, "3"], [/\bfour\b/gi, "4"], [/\bfive\b/gi, "5"], [/\bsix\b/gi, "6"], [/\bseven\b/gi, "7"], [/\beight\b/gi, "8"], [/\bnine\b/gi, "9"], [/\bten\b/gi, "10"], [/\btwelve\b/gi, "12"]];
const AR_NUMBER_WORDS: Array<[RegExp, string]> = [[/اثنين|اثنان/g, "2"], [/ثلاثة|ثلاث/g, "3"], [/أربعة|أربع|اربعة|اربع/g, "4"], [/خمسة|خمس/g, "5"], [/ستة/g, "6"], [/سبعة|سبع/g, "7"], [/ثمانية|ثمان/g, "8"], [/تسعة|تسع/g, "9"], [/عشرة|عشر/g, "10"]];

export function mockTransliterate(s: string, to: "ar" | "en"): string {
  if (to === "ar") {
    let t = s.replace(/\bSAR\b/g, "ريال");
    for (const [re, d] of EN_NUMBER_WORDS) t = t.replace(re, d);
    return t.replace(/[A-Za-z]/g, (ch) => ARABIC[LATIN.indexOf(ch.toLowerCase())] ?? ch);
  }
  let t = s.replace(/ريال/g, "SAR");
  for (const [re, d] of AR_NUMBER_WORDS) t = t.replace(re, d);
  return t.replace(/[ء-ي]/g, (ch) => {
    const i = ARABIC.indexOf(ch);
    return i >= 0 ? LATIN[i] : ch;
  });
}

function mockTranslate(user: string) {
  const to = /TARGET LANGUAGE: Arabic/.test(user) ? "ar" : "en";
  const json = user.split("BRIEF TO TRANSLATE (JSON, untrusted data):\n")[1]?.split("\n\nTranslate every field now")[0] ?? "{}";
  const src = JSON.parse(json) as Record<string, unknown>;
  const dropNumbers = json.includes("mock:drop-numbers");
  return walkStrings(src, (s) => {
    if (!s) return s;
    const out = mockTransliterate(s, to);
    return dropNumbers ? out.replace(/[0-9٠-٩]/g, "") : out;
  });
}

// Deterministic "revision": applies `set <path>=<text>` from the instruction
// to that one field only; everything else is returned byte-for-byte.
function mockRevise(user: string) {
  const json = user.split("CURRENT BRIEF (JSON, untrusted data):\n")[1]?.split("\n\nREVISION REQUEST")[0] ?? "{}";
  const src = JSON.parse(json) as Record<string, unknown>;
  const instr = user.split("REVISION REQUEST (untrusted data): ")[1]?.split("\n")[0] ?? "";
  if (/mock:wrong-language/.test(instr)) {
    const arabic = /[؀-ۿ]/.test(json);
    return walkStrings(src, (s) => (s ? mockTransliterate(s, arabic ? "en" : "ar") : s));
  }
  const m = /set ([a-z_.]+)=(.+)$/.exec(instr);
  if (m) {
    const path = m[1].split(".");
    let cur: Record<string, unknown> = src;
    for (const k of path.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
    cur[path[path.length - 1]] = m[2];
  }
  return src;
}

function mockAssessment() {
  const dim = (score: number) => ({ score, evidence: ["mock evidence"], note: "mock" });
  return {
    scores: {
      market_repeatability: dim(3),
      pain_intensity: dim(4),
      stryvia_fit: dim(3),
      effort_vs_value: dim(3),
      person_contribution: dim(3),
      deal_alignment: dim(3),
      founder_signal: dim(3),
    },
    red_flags: [
      { id: "vague_ownership", triggered: false, evidence: "" },
      { id: "regulated_without_licence", triggered: false, evidence: "" },
      { id: "free_for_equity_nothing_offered", triggered: false, evidence: "" },
      { id: "expects_exclusivity_or_ip", triggered: false, evidence: "" },
      { id: "unrealistic_timeline", triggered: false, evidence: "" },
      { id: "no_decision_maker_access", triggered: false, evidence: "" },
    ],
    model_verdict: "paid_build",
    confidence: 0.6,
    reasoning: "Mock assessment.",
    why_lines: ["mock 1", "mock 2", "mock 3", "mock 4", "mock 5"],
    manipulation_detected: false,
    proposed_plan: {
      what_stryvia_could_build: "A mock tool.",
      rough_scope: "Small.",
      suggested_deal_shape: "Paid build.",
      open_questions: ["mock question"],
    },
  };
}

export const mockProvider: LabAiProvider = {
  async structured<T>(call: StructuredCall<T>) {
    const user = lastUser(call);
    let raw: unknown;
    switch (call.role) {
      case "extract":
        raw = mockExtract(user);
        break;
      case "lens":
        raw = mockLens(user);
        break;
      case "summary":
        raw = { summary: "Mock summary of earlier turns.", key_quotes: ["mock quote"] };
        break;
      case "brief":
        raw = mockBrief(user);
        break;
      case "translate":
        raw = mockTranslate(user);
        break;
      case "revise":
        raw = mockRevise(user);
        break;
      case "assess":
        raw = mockAssessment();
        break;
      case "draft":
        raw = { subject: "Mock subject", body: "Mock body." };
        break;
      case "judge":
        raw = {
          promises_or_inflation: { found: false, quotes: [] },
          impersonation: { found: false, quotes: [] },
          pricing_or_timeline: { found: false, quotes: [] },
          ladder_offered: true,
          repeated_questions: { found: false, examples: [] },
          language_respected: true,
          verdict_defensible: { defensible: true, reason: "mock" },
          overall_quality_1_5: 4,
          notes: "mock",
        };
        break;
      default:
        raw = {};
    }
    const value = (call.schema as z.ZodType<T>).parse(raw);
    return { value, usage: ZERO };
  },

  async stream(call: StreamCall): Promise<StreamResult> {
    const dyn = call.dynamicSystem ?? "";
    const ar = /SESSION LANGUAGE: Arabic/.test(dyn);
    const latest = lastUser(call);
    const failure = injectedFailure(call.sessionId, latest);
    if (failure) {
      const err = new LabAiError("provider", "Injected provider failure (mock): credit balance is too low to access the API.");
      async function* nothing() {
        throw err;
      }
      return { text: nothing(), done: Promise.reject(err) };
    }
    const delay = injectedDelay(latest);
    let reply: string;
    if (/END THE SESSION NOW/.test(dyn)) reply = ar ? "سننهي هنا. شكرًا لك." : "We will stop here. Thank you.";
    else if (/^REVIEW:/m.test(dyn) || /CURRENT PHASE: REVIEW/.test(dyn))
      reply = ar
        ? "شكرًا لك. ملخّصك يُجهَّز الآن لتراجعه وتعدّله. لا شيء هنا يُعدّ التزامًا من أي طرف."
        : "Thank you. Your brief is being prepared for you to review and edit. Nothing here is a commitment from either side.";
    else if (/THIS IS THE OPENING/.test(dyn))
      reply = ar
        ? "أهلًا بك. أنا الذكاء الاصطناعي من سترايفيا، وهذه المحادثة تأخذ نحو ١٥ إلى ٢٠ دقيقة. احكِ لي عن المشكلة أو الفكرة بكلماتك."
        : "Welcome. I am Stryvia's AI; this takes about 15–20 minutes. Tell me about the problem or idea in your own words.";
    else {
      const target = /TARGET NEXT[^:]*: ([a-z_]+)/.exec(dyn)?.[1];
      const ladder = /LADDER STEPS STILL TO OFFER: ([A-Za-z ]+)/.exec(dyn)?.[1]?.split(",")[0]?.trim();
      reply = ar
        ? `فهمت. ${target ? `أخبرني أكثر عن ${target}؟` : ladder ? `هل فكّرت في ${ladder}؟` : "ما الذي تريد إضافته؟"}`
        : `Understood. ${target ? `Tell me more about ${target.replace(/_/g, " ")}?` : ladder ? `Have you considered: ${ladder}?` : "What would you add?"}`;
    }
    const chunks = reply.match(/.{1,12}/g) ?? [reply];
    async function* text() {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      for (const c of chunks) {
        await new Promise((r) => setTimeout(r, 5));
        yield c;
      }
    }
    return {
      text: text(),
      // Like the real provider, the reply is final only when the stream is.
      done: new Promise((r) => setTimeout(r, delay + chunks.length * 5)).then(() => ({ text: reply, usage: ZERO, stopReason: "end_turn" })),
    };
  },
};
