import type { LabLanguage } from "@/config/lab.config";
import type { Brief } from "./schemas";

// Deterministic checks that a generated brief version (translation, revision)
// did not lose or alter what the visitor approved. These run in code, after
// the model, and a failing check blocks the version from ever becoming a
// proposal — the model is not trusted to preserve facts by instruction alone.
// Pure; unit-tested.

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Normalise Arabic-Indic digits to Western digits. */
export function westernDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d);
    return String(i >= 0 ? i : EXTENDED_ARABIC_INDIC.indexOf(d));
  });
}

// Number words we expect in briefs (durations, small counts). Values are
// canonical numeric strings so "four weeks" and "4 weeks" and "أربعة أسابيع"
// compare equal.
// "one"/"واحد" is deliberately absent: a singular noun carries the count in
// both languages ("one storekeeper" → "أمين مخزن"), so it cannot be required.
const NUMBER_WORDS: Record<string, string> = {
  two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", hundred: "100", thousand: "1000",
  "اثنين": "2", "اثنان": "2", "اثنتين": "2", "ثلاث": "3", "ثلاثة": "3", "أربع": "4", "أربعة": "4", "اربع": "4", "اربعة": "4",
  "خمس": "5", "خمسة": "5", "ست": "6", "ستة": "6", "سبع": "7", "سبعة": "7", "ثمان": "8", "ثمانية": "8", "تسع": "9", "تسعة": "9", "عشر": "10", "عشرة": "10",
  "عشرين": "20", "ثلاثين": "30", "أربعين": "40", "خمسين": "50", "ستين": "60", "مئة": "100", "مائة": "100", "ألف": "1000", "الف": "1000",
  // Arabic dual forms carry the number 2 inside the noun.
  "أسبوعين": "2", "اسبوعين": "2", "شهرين": "2", "يومين": "2", "سنتين": "2", "مرتين": "2",
};

// No `g` flag: a global regex keeps `lastIndex` between `.test()` calls and
// would make the currency check flip between true and false on alternate
// calls — a translation could then be rejected (or accepted) at random.
const CURRENCY = /\b(SAR|USD|EUR|AED|KWD|QAR|BHD|OMR|EGP|GBP)\b|\$|€|£|ريال|ريالات|درهم|دينار|دولار|جنيه|ر\.س/i;

export type FactSet = { numbers: string[]; currency: boolean; percent: boolean };

/** Numbers (digits or words), currency mentions and percentages in a text. */
export function extractFacts(text: string): FactSet {
  const t = westernDigits(text);
  const numbers = new Set<string>();
  for (const m of t.matchAll(/\d[\d,.٫٬]*\d|\d/g)) {
    const raw = m[0].replace(/[,٬]/g, "").replace(/٫/g, ".");
    // Drop trailing dot from sentence ends ("5.")
    const clean = raw.replace(/\.$/, "");
    if (clean) numbers.add(clean.replace(/^0+(?=\d)/, ""));
  }
  // Letters only: Arabic punctuation (، ؛ ؟) sits below U+0620 and must not
  // glue to a word.
  for (const m of t.toLowerCase().matchAll(/[a-zؠ-ٟٮ-ۓ]+/g)) {
    const word = m[0].replace(/^(و|ال|ب|ل|ف|ك)/, "");
    const v = NUMBER_WORDS[m[0]] ?? NUMBER_WORDS[word];
    if (v) numbers.add(v);
    // Arabic dual (سائقان / سائقين / منسقتين) carries "two" inside the noun.
    else if (/[ؠ-ي]{3,}(ان|ين|تان|تين)$/.test(word) && word.length >= 5) numbers.add("2");
  }
  return { numbers: [...numbers], currency: CURRENCY.test(text), percent: /%|٪|percent|بالمئة|بالمائة/i.test(text) };
}

/** Every string in a brief, in document order. */
export function briefStrings(b: Brief): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(b);
  return out;
}

export type PreservationResult = { ok: boolean; missingNumbers: string[]; lostCurrency: boolean; lostPercent: boolean; addedNumbers: string[] };

/**
 * Compare the facts of a source brief with a generated one. Every number in
 * the source must appear in the result (as digits or number words); currency
 * and percent mentions must survive. Numbers the result adds are reported so
 * the visitor can see them; they are not by themselves a failure (a revision
 * may legitimately add a figure the visitor asked for), the caller decides.
 */
export function checkFactPreservation(source: Brief, result: Brief, opts: { allowAdded?: boolean } = {}): PreservationResult {
  const a = extractFacts(briefStrings(source).join("\n"));
  const b = extractFacts(briefStrings(result).join("\n"));
  const bSet = new Set(b.numbers);
  const aSet = new Set(a.numbers);
  const missingNumbers = a.numbers.filter((n) => !bSet.has(n));
  const addedNumbers = b.numbers.filter((n) => !aSet.has(n));
  const lostCurrency = a.currency && !b.currency;
  const lostPercent = a.percent && !b.percent;
  const ok = missingNumbers.length === 0 && !lostCurrency && !lostPercent && (opts.allowAdded !== false || addedNumbers.length === 0);
  return { ok, missingNumbers, lostCurrency, lostPercent, addedNumbers };
}

/** Share of letters that are Arabic vs Latin across the brief's prose. */
export function scriptShare(b: Brief): { arabic: number; latin: number } {
  const text = briefStrings(b).join(" ");
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const la = (text.match(/[A-Za-z]/g) ?? []).length;
  const total = ar + la || 1;
  return { arabic: ar / total, latin: la / total };
}

/** True when the prose is predominantly in the declared language. */
export function matchesLanguage(b: Brief, language: LabLanguage): boolean {
  const s = scriptShare(b);
  return language === "ar" ? s.arabic >= 0.6 : s.latin >= 0.6;
}

/** Fields that changed outside the ones a revision was allowed to touch. */
export function unexpectedChanges(changes: Array<{ path: string }>, allowedPrefixes: string[]): string[] {
  return changes.map((c) => c.path).filter((p) => !allowedPrefixes.some((a) => p === a || p.startsWith(`${a}.`)));
}
