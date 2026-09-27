// ---------------------------------------------------------------------------
// STRYVIA IDEA LAB — product configuration (brief §1, §2, §6, §9).
//
// Everything a founder may want to change without touching code lives here.
// Pure constants only — no `process.env` — so this file is safe to import from
// client components. Server-side env overrides are layered on top in
// `src/lib/lab/env.ts` (`getLabSettings()`).
// ---------------------------------------------------------------------------

export type LabLanguage = "en" | "ar";

export const LAB_LANGUAGES: readonly LabLanguage[] = ["en", "ar"] as const;

/** Name shown to visitors, per language (§2). */
export const LAB_NAME: Record<LabLanguage, string> = {
  en: "Stryvia Idea Lab",
  ar: "مختبر الأفكار من سترايفيا",
};

/** Public URL path of the Lab. Changing the folder name in `src/app` is still
 *  a code change; this constant drives links, emails and redirects. */
export const LAB_PATH = "/lab";

/** Legacy/brief path that redirects to the real admin. */
export const LAB_ADMIN_PATH = "/supadmin/lab";

/** No response-time promise is made unless `LAB_RESPONSE_DAYS` is set
 *  explicitly by the owner (see `lib/lab/env.ts`). */

/** Consent text version — bump whenever the terms wording changes (§2.1).
 *  A repo-guard test asserts the i18n key `lab.consent.version` matches. */
export const LAB_CONSENT_VERSION = "2026-09-v4";

/** Deal types Stryvia is open to (§6). The interviewer presents these
 *  neutrally and captures which one the visitor expects. */
export const LAB_DEAL_TYPES = [
  {
    id: "paid_build",
    en: "A paid custom build (you own the result)",
    ar: "بناء مخصص مدفوع (أنت تملك النتيجة)",
    accepted: true,
  },
  {
    id: "equity_or_revenue_share",
    en: "An equity or revenue-share partnership",
    ar: "شراكة بحصة أو بنسبة من الإيرادات",
    accepted: true,
  },
  {
    id: "hybrid",
    en: "A hybrid: part paid, part partnership",
    ar: "مزيج: جزء مدفوع وجزء شراكة",
    accepted: true,
  },
  {
    id: "free_for_equity",
    en: "Built for free in exchange for equity only",
    ar: "بناء مجاني مقابل حصة فقط",
    // Only acceptable when the person brings distribution or capital (§6).
    accepted: false,
    acceptedWhen: ["distribution", "capital"],
  },
  { id: "unsure", en: "Not sure yet", ar: "لم أقرر بعد", accepted: true },
] as const;

export type LabDealTypeId = (typeof LAB_DEAL_TYPES)[number]["id"];

/** Models per role (§1). Interview + extraction on Sonnet (fast, streaming);
 *  brief + private assessment on Opus. Env-overridable via LAB_MODEL_*. */
export const LAB_MODELS = {
  interview: "claude-sonnet-5",
  extract: "claude-sonnet-5",
  lens: "claude-sonnet-5",
  summary: "claude-sonnet-5",
  brief: "claude-opus-5-5",
  translate: "claude-opus-5-5",
  revise: "claude-opus-5-5",
  assess: "claude-opus-5-5",
  draft: "claude-opus-5-5",
  judge: "claude-opus-5-5",
  visitor: "claude-sonnet-5", // persona harness only
} as const;

export type LabModelRole = keyof typeof LAB_MODELS;

/** Effort per role. Opus 5.5 defaults to `medium`; we set it explicitly. */
export const LAB_EFFORT: Record<LabModelRole, "low" | "medium" | "high" | "xhigh"> = {
  interview: "low",
  extract: "low",
  lens: "low",
  summary: "low",
  brief: "medium",
  translate: "low",
  revise: "medium",
  assess: "high",
  draft: "medium",
  judge: "medium",
  visitor: "low",
};

/** Max output tokens per role. */
export const LAB_MAX_TOKENS: Record<LabModelRole, number> = {
  interview: 1200,
  extract: 2500,
  lens: 2500,
  summary: 1500,
  brief: 8000,
  translate: 8000,
  revise: 8000,
  assess: 8000,
  draft: 1500,
  judge: 3000,
  visitor: 600,
};

/** USD per million tokens — used for `lab_ai_calls.cost_usd` and the spend
 *  alert. Update when pricing changes. Cache write ≈ 1.25× input. */
export const LAB_PRICES_PER_MTOK: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/** Conversation shape (§3, §4.8). */
export const LAB_CONVERSATION = {
  /** A slot counts as "filled" at or above this confidence. */
  slotConfidenceThreshold: 0.7,
  /** Hard cap on visitor turns per session. */
  maxTurns: 60,
  /** Hard cap on total tokens (input + output) per session. */
  tokenBudget: 350_000,
  /** Warn the visitor when this fraction of the budget is used. */
  budgetWarnAt: 0.85,
  /** Once the transcript exceeds this many messages, older turns are folded
   *  into a rolling summary… */
  rollingSummaryAfterMessages: 24,
  /** …keeping this many of the most recent messages verbatim. */
  keepVerbatimMessages: 12,
  /** Phase A may not run longer than this many visitor turns. */
  maxTurnsUnderstand: 14,
  /** Phase B may not run longer than this many visitor turns. */
  maxTurnsExpand: 10,
  /** Phase C may not run longer than this many visitor turns. */
  maxTurnsCommit: 10,
  /** Minimum required-slot coverage before "finish early" is honoured
   *  without a nudge. Below this the interviewer asks one more time. */
  minCoverageForEarlyFinish: 0.5,
  /** Max characters accepted per visitor message. */
  maxMessageChars: 4000,
} as const;

/** Abuse, cost and privacy controls (§9). */
export const LAB_LIMITS = {
  startPerIpPerHour: 10,
  startPerEmailPerDay: 3,
  turnsPerSessionPerMinute: 12,
  magicLinkPerEmailPerHour: 3,
  magicLinkPerEmailPerDay: 6,
  transcribePerSessionPerMinute: 6,
  magicLinkTtlHours: 24 * 7,
  cookieTtlDays: 30,
  retentionMonths: 12,
  turnLockTtlSeconds: 125,
  monthlySpendAlertUsd: 200,
  monthlySpendHardCapUsd: 600,
  maxAudioBytes: 10 * 1024 * 1024,
  maxAudioSeconds: 120,
} as const;

/** Expansion ladder steps (§2.4) — offered as questions, never as promises. */
export const LAB_LADDER_STEPS = ["automate", "intelligence", "productize", "scale"] as const;
export type LabLadderStep = (typeof LAB_LADDER_STEPS)[number];

export const LAB_LADDER_LABELS: Record<LabLadderStep, Record<LabLanguage, string>> = {
  automate: { en: "Automate it", ar: "أتمتته" },
  intelligence: { en: "Add intelligence", ar: "إضافة الذكاء" },
  productize: { en: "Productize it", ar: "تحويله إلى منتج" },
  scale: { en: "Scale it", ar: "التوسّع" },
};

/** Phases of the visitor journey (§2). */
export const LAB_PHASES = ["intro", "understand", "expand", "commit", "review", "done"] as const;
export type LabPhase = (typeof LAB_PHASES)[number];

/** Session statuses (§7). */
export const LAB_STATUSES = ["in_progress", "submitted", "reviewed", "closed", "deleted"] as const;
export type LabStatus = (typeof LAB_STATUSES)[number];
