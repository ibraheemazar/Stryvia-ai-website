import { describe, expect, it } from "vitest";
import { checkFactPreservation, extractFacts, matchesLanguage, westernDigits } from "@/lib/lab/brief-check";
import { diffBrief, versionStatuses } from "@/lib/lab/brief-diff";
import type { Brief } from "@/lib/lab/schemas";

// The deterministic guards that sit between the model and the visitor's
// approved brief. These are the checks that make "translation preserves the
// exact saved source" a property of the code, not of the prompt.

const base: Brief = {
  title: "Camera and lighting rental in Riyadh",
  one_line: "Shared availability with human-approved reservations.",
  what_you_came_with: {
    problem: "Three coordinators confirm bookings independently; 80 items; about 120 bookings a month; 4 conflicts last month.",
    who_is_affected: "Coordinators, one storekeeper, two drivers.",
    current_process: ["WhatsApp confirmation", "Spreadsheet update"],
    frequency_and_volume: "About 120 bookings a month.",
    cost_today: "SAR 6,000 is an unaudited estimate of last month's direct conflict losses.",
    tried_so_far: "Nothing yet.",
    tools: "WhatsApp, Excel",
    desired_outcome: "Shared availability; human-approved reservations only.",
  },
  what_it_could_become: {
    intro: "Ideas explored together, not commitments.",
    automate: "Shared availability view (AI suggestion; you were interested).",
    add_intelligence: null,
    productize: null,
    scale: null,
    honest_ceiling_note: "The total business value is unverified. SAR 6,000 is an unaudited estimate, not a ceiling on potential value. No partnership decision has been made; Stryvia's team must manually review.",
  },
  what_you_bring: ["Domain expertise"],
  what_you_expect: "Buy and build are equally open; no preference has been expressed. MANUAL CORRECTION: budget SAR 17,350; pilot four weeks; both flexible. Human-approved reservations only.",
  constraints: "No autonomous orders, no payments, no SaaS launch.",
  scope: { confirmed: ["Internal tool"], excluded: ["Payments", "SaaS launch"], assumptions: [], open_questions: ["Total value beyond conflict losses"] },
  next_step_note: "Submitted for manual review; no decision has been made.",
};

describe("fact extraction", () => {
  it("normalises Arabic-Indic digits and reads number words in both languages", () => {
    expect(westernDigits("١٧٬٣٥٠")).toBe("17٬350");
    const en = extractFacts("budget SAR 17,350; pilot four weeks; 80 items; 6,000");
    expect(en.numbers).toEqual(expect.arrayContaining(["17350", "4", "80", "6000"]));
    expect(en.currency).toBe(true);
    const ar = extractFacts("الميزانية ١٧,٣٥٠ ريال؛ التجربة أربعة أسابيع؛ 80 قطعة");
    expect(ar.numbers).toEqual(expect.arrayContaining(["17350", "4", "80"]));
    expect(ar.currency).toBe(true);
    expect(extractFacts("أسبوعين").numbers).toContain("2");
  });
});

describe("fact preservation", () => {
  it("is stateless: repeated checks of the same pair give the same answer", () => {
    // A global regex would keep lastIndex between calls and flip the currency
    // result on alternate runs.
    const results = Array.from({ length: 6 }, () => checkFactPreservation(base, base));
    expect(results.every((r) => r.ok && !r.lostCurrency)).toBe(true);
    expect(Array.from({ length: 4 }, () => extractFacts("SAR 6,000 and ريال").currency)).toEqual([true, true, true, true]);
  });

  it("passes when every number, the currency and the percent survive", () => {
    const ar: Brief = JSON.parse(JSON.stringify(base));
    ar.what_you_expect = "الشراء والبناء متاحان بالتساوي؛ لم يُعبَّر عن أي تفضيل. تصحيح يدوي: الميزانية 17,350 ريال؛ التجربة أربعة أسابيع؛ كلاهما مرن. حجوزات بموافقة بشرية فقط.";
    ar.what_it_could_become.honest_ceiling_note = "القيمة الإجمالية غير مؤكدة. 6,000 ريال تقدير غير مدقق، وليس سقفًا للقيمة. لم يُتَّخذ أي قرار شراكة؛ يجب أن يراجع فريق سترايفيا يدويًا.";
    ar.what_you_came_with.problem = "ثلاثة منسقين يؤكدون الحجوزات بشكل مستقل؛ 80 قطعة؛ نحو 120 حجزًا شهريًا؛ 4 تعارضات الشهر الماضي.";
    ar.what_you_came_with.frequency_and_volume = "نحو 120 حجزًا شهريًا.";
    ar.what_you_came_with.cost_today = "6,000 ريال تقدير غير مدقق لخسائر التعارض المباشرة الشهر الماضي.";
    ar.what_you_came_with.who_is_affected = "المنسقون، أمين مخزن واحد، سائقان.";
    const r = checkFactPreservation(base, ar);
    expect(r.missingNumbers).toEqual([]);
    expect(r.lostCurrency).toBe(false);
    expect(r.ok).toBe(true);
  });

  it("fails when the translation replaces the exact budget and duration with vague wording", () => {
    const bad: Brief = JSON.parse(JSON.stringify(base));
    bad.what_you_expect = "تم تقديم ميزانية تقريبية ومدة تجريبية.";
    const r = checkFactPreservation(base, bad);
    expect(r.ok).toBe(false);
    // "4" still appears elsewhere in the brief ("4 conflicts"), so only the
    // budget is reported; the duration is covered by the next case.
    expect(r.missingNumbers).toEqual(["17350"]);
    bad.what_you_came_with.problem = bad.what_you_came_with.problem.replace("4 conflicts", "some conflicts");
    expect(checkFactPreservation(base, bad).missingNumbers).toEqual(expect.arrayContaining(["17350", "4"]));
  });

  it("does not require the word 'one' and reads Arabic duals as two", () => {
    expect(extractFacts("one storekeeper, two drivers").numbers).toEqual(["2"]);
    expect(extractFacts("أمين مخزن واحد، سائقان").numbers).toEqual(["2"]);
    expect(extractFacts("منسقتين اثنتين").numbers).toEqual(["2"]);
  });

  it("fails when the currency disappears", () => {
    const bad: Brief = JSON.parse(JSON.stringify(base));
    bad.what_you_expect = bad.what_you_expect.replace(/SAR /g, "");
    bad.what_you_came_with.cost_today = bad.what_you_came_with.cost_today.replace("SAR ", "");
    bad.what_it_could_become.honest_ceiling_note = bad.what_it_could_become.honest_ceiling_note.replace("SAR ", "");
    expect(checkFactPreservation(base, bad).lostCurrency).toBe(true);
  });

  it("reports numbers a revision added without failing it", () => {
    const rev: Brief = JSON.parse(JSON.stringify(base));
    rev.what_it_could_become.honest_ceiling_note += " Competitors: 12 tools were named but not researched.";
    const r = checkFactPreservation(base, rev);
    expect(r.ok).toBe(true);
    expect(r.addedNumbers).toContain("12");
  });
});

describe("mock transliteration used by the e2e suite", () => {
  it("keeps every number, the currency and number words as digits, and reads as the target script", async () => {
    const { mockTransliterate } = await import("@/lib/lab/ai-mock");
    const ar: Brief = JSON.parse(JSON.stringify(base));
    const walk = (v: unknown): unknown => (typeof v === "string" ? mockTransliterate(v, "ar") : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)])) : v);
    const translated = walk(ar) as Brief;
    expect(translated.what_you_expect).toMatch(/17,350/);
    expect(translated.what_you_expect).toMatch(/ريال/);
    expect(translated.what_you_expect).toMatch(/\b4\b/);
    expect(matchesLanguage(translated, "ar")).toBe(true);
    const r = checkFactPreservation(base, translated);
    expect(r.ok).toBe(true);
    const back = walk(translated) as Brief;
    void back;
    const en = JSON.parse(JSON.stringify(translated), (_k, v) => (typeof v === "string" ? mockTransliterate(v, "en") : v)) as Brief;
    expect(matchesLanguage(en, "en")).toBe(true);
    expect(checkFactPreservation(translated, en).ok).toBe(true);
  });
});

describe("language check", () => {
  it("detects the document language from the prose, not from metadata", () => {
    expect(matchesLanguage(base, "en")).toBe(true);
    expect(matchesLanguage(base, "ar")).toBe(false);
    const ar: Brief = JSON.parse(JSON.stringify(base));
    for (const k of Object.keys(ar.what_you_came_with) as Array<keyof typeof ar.what_you_came_with>) {
      if (k !== "current_process") (ar.what_you_came_with as unknown as Record<string, string>)[k] = "نص عربي طويل بما يكفي ليكون هو الغالب في المستند كله";
    }
    ar.what_you_expect = "نص عربي";
    ar.what_it_could_become.honest_ceiling_note = "نص عربي آخر";
    ar.what_it_could_become.automate = "نص عربي";
    ar.what_it_could_become.intro = "نص عربي";
    ar.title = "عنوان عربي";
    ar.one_line = "سطر عربي";
    ar.constraints = "قيود عربية";
    ar.next_step_note = "ملاحظة عربية";
    ar.what_you_bring = ["خبرة"];
    ar.scope = { confirmed: ["أداة"], excluded: ["مدفوعات"], assumptions: [], open_questions: ["سؤال"] };
    ar.what_you_came_with.current_process = ["خطوة", "خطوة"];
    expect(matchesLanguage(ar, "ar")).toBe(true);
  });
});

describe("diff and version status", () => {
  it("lists only the fields that changed, in document order", () => {
    const rev: Brief = JSON.parse(JSON.stringify(base));
    rev.what_it_could_become.honest_ceiling_note = "Changed.";
    rev.scope.open_questions.push("Another question");
    const changes = diffBrief(base, rev);
    expect(changes.map((c) => c.path)).toEqual(["what_it_could_become.honest_ceiling_note", "scope.open_questions"]);
    expect(changes[0].before).toContain("unverified");
  });

  it("marks a translation as proposed only while its source is still current, and never after submission", () => {
    const rows = [
      { version: 1, language: "en" as const, kind: "generated" as const, source_version: null, created_at: "1" },
      { version: 2, language: "en" as const, kind: "edited" as const, source_version: 1, created_at: "2" },
      { version: 3, language: "ar" as const, kind: "translated" as const, source_version: 2, created_at: "3" },
    ];
    let st = versionStatuses(rows, { current: 2, submitted: null });
    expect(st.map((s) => s.status)).toEqual(["superseded", "current", "proposed"]);
    // A newer edit became current: the old translation can no longer be accepted.
    st = versionStatuses([...rows, { version: 4, language: "en" as const, kind: "edited" as const, source_version: 2, created_at: "4" }], { current: 4, submitted: null });
    expect(st.find((s) => s.version === 3)?.status).toBe("superseded");
    st = versionStatuses(rows, { current: 3, submitted: 3 });
    expect(st.find((s) => s.version === 3)?.status).toBe("submitted");
  });
});
