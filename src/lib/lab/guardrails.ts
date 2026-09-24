// Code-level guardrails (brief §4.6). Prompt-level rules live in the prompt
// files; these are the checks the code enforces regardless of what the model
// says. Pure module — used by routes, the harness and the tests.

export type GuardrailHit = {
  rule: string;
  match: string;
  index: number;
};

/**
 * Wrap visitor-supplied text as untrusted data for a prompt. Angle brackets
 * are neutralised so a visitor cannot close the tag and inject instructions.
 */
export function wrapUntrusted(text: string, tag = "visitor_message"): string {
  const safe = text.replace(/</g, "‹").replace(/>/g, "›");
  return `<${tag} trust="untrusted">\n${safe}\n</${tag}>`;
}

/** Trim, normalise whitespace and cap the size of visitor text. */
export function sanitizeVisitorText(text: unknown, maxChars: number): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

// Things the interviewer must never say (§4.6): promises, pricing, timelines,
// "Stryvia will build", claiming to be a person. English and Arabic forms.
const BANNED: Array<{ rule: string; re: RegExp }> = [
  {
    rule: "promise_build",
    re: /\b(stryvia|we)\s+(will|'ll|are going to|is going to|can definitely|promise to)\s+(build|develop|deliver|ship|create)\b/i,
  },
  {
    rule: "promise_build_ar",
    re: /(سترايفيا|نحن|سنقوم|سوف)\s*(سنبني|سنقوم ببناء|سنطور|سننفذ|ستبني|سيبني|نعدك|نضمن)/,
  },
  { rule: "promise_generic", re: /\b(we|i)\s+(promise|guarantee)\b/i },
  { rule: "promise_generic_ar", re: /(أعدك|نعدك|أضمن|نضمن لك)/ },
  {
    rule: "pricing",
    re: /\b(it will cost|the price is|our price|pricing starts|for (only )?\$?\d[\d,]*\s?(sar|usd|aed|riyals?|dollars?)|(sar|usd|aed)\s?\d[\d,]{2,})\b/i,
  },
  { rule: "pricing_ar", re: /(سيكلف(ك)?|السعر هو|بسعر|تكلفته)\s*\d/ },
  {
    rule: "timeline_commitment",
    re: /\b(we|stryvia)\s+(will|can)\s+(have it|deliver( it)?|finish( it)?|launch( it)?|ship( it)?)\s+(ready\s+)?(in|within|by)\s+\d+\s*(days?|weeks?|months?)\b/i,
  },
  { rule: "timeline_commitment_ar", re: /(سننجزه|سنسلمه|سيكون جاهزًا|سيكون جاهزا)\s*(خلال|في)\s*\d+/ },
  { rule: "impersonation", re: /\b(i am|i'm|this is)\s+(ibrahim|the founder|stryvia's founder|a (real )?(person|human))\b/i },
  { rule: "impersonation_ar", re: /(أنا إبراهيم|انا ابراهيم|معك إبراهيم|أنا المؤسس|أنا إنسان حقيقي)/ },
  { rule: "banned_voice", re: /\b(hire us|our team will|done for you|we deliver)\b/i },
];

/** Scan a finished assistant message for banned claims. */
export function lintAssistantText(text: string): GuardrailHit[] {
  const hits: GuardrailHit[] = [];
  for (const { rule, re } of BANNED) {
    const m = re.exec(text);
    if (m) hits.push({ rule, match: m[0], index: m.index });
  }
  return hits;
}

// Quick heuristic for injection attempts, used to log and to feed the
// assessor's `manipulation_detected` alongside the extractor's own signal.
const INJECTION: RegExp[] = [
  /ignore (all|any|the|your|previous|above) (previous |prior )?(instructions|rules|prompts?)/i,
  /disregard (your|the|all) (instructions|rules|system prompt)/i,
  /you are now (a|an|the) /i,
  /system prompt/i,
  /score (this|it|me) (a )?(5|five)\b/i,
  /rate (this|it|me) (as )?(5|five)/i,
  /(verdict|assessment|score).*(priority_call|productize|5\/5)/i,
  /تجاهل (كل |جميع )?(التعليمات|الأوامر|القواعد)/,
  /قيّم(ني|ها| هذه)? (بـ ?)?(5|خمسة)/,
  /أنت الآن /,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION.some((re) => re.test(text));
}

/** Escape for HTML rendering of any visitor-derived text. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bidi-isolate a fragment (email, phone, URL, number) inside HTML. */
export function bdi(s: string): string {
  return `<bdi dir="ltr">${escapeHtml(s)}</bdi>`;
}

/** Detect the dominant script of a text — used for `dir="auto"` decisions and
 *  the language-switch heuristic. */
export function dominantScript(text: string): "ar" | "latin" | "mixed" | "none" {
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (ar === 0 && latin === 0) return "none";
  if (ar > 0 && latin > 0 && Math.min(ar, latin) / Math.max(ar, latin) > 0.6) return "mixed";
  return ar >= latin ? "ar" : "latin";
}
