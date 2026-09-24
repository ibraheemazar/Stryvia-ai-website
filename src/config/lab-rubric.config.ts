// ---------------------------------------------------------------------------
// STRYVIA IDEA LAB — private scoring rubric (brief §5).
//
// Edit weights, thresholds and red flags here. The assessor model scores each
// dimension 1–5 with evidence; the VERDICT is computed deterministically in
// `scoreToVerdict()` below from those scores, never trusted from the model.
// Bump RUBRIC_VERSION whenever anything here changes so assessments can be
// compared across versions.
// ---------------------------------------------------------------------------

export const RUBRIC_VERSION = "2026-09-v1";

export type RubricDimensionId =
  | "market_repeatability"
  | "pain_intensity"
  | "stryvia_fit"
  | "effort_vs_value"
  | "person_contribution"
  | "deal_alignment"
  | "founder_signal";

export type RubricDimension = {
  id: RubricDimensionId;
  label: string;
  weight: number; // relative; normalised in scoring
  guidance: string; // what a 1 and a 5 look like — fed to the assessor verbatim
};

export const RUBRIC_DIMENSIONS: RubricDimension[] = [
  {
    id: "market_repeatability",
    label: "Market repeatability",
    weight: 1.4,
    guidance:
      "How many others in MENA/GCC have this exact problem. 1 = unique to this person or a handful of organisations; 3 = a recognisable niche (hundreds); 5 = a whole profession or sector across several GCC/MENA countries with the same workflow.",
  },
  {
    id: "pain_intensity",
    label: "Pain intensity",
    weight: 1.3,
    guidance:
      "Evidence of real cost, time, risk or revenue lost today. 1 = mild inconvenience, no numbers; 3 = clear recurring cost with rough figures; 5 = quantified, frequent, and carries risk (regulatory, safety, or revenue) the person can cite from experience.",
  },
  {
    id: "stryvia_fit",
    label: "Stryvia fit",
    weight: 1.1,
    guidance:
      "Reuses Stryvia's existing stack and products (Chat, Studio, Rentals, Motion, Persona, Captures, Signal, SEO Autopilot) or opens a strategic new line Stryvia would want. 1 = unrelated hardware or deep-tech; 3 = adjacent; 5 = directly composable from existing Stryvia products or a clear strategic new product line.",
  },
  {
    id: "effort_vs_value",
    label: "Build effort vs value",
    weight: 1.0,
    guidance:
      "Rough complexity against the size of the opportunity. 1 = huge build for a small prize; 3 = balanced; 5 = modest build (weeks, standard integrations) for a large, repeatable prize.",
  },
  {
    id: "person_contribution",
    label: "Contribution of the person",
    weight: 1.2,
    guidance:
      "What they bring: domain expertise, distribution, first clients, capital, data, team. 1 = an idea only; 3 = deep expertise but no clients/capital; 5 = expertise plus committed first clients or distribution, or capital, or unique data.",
  },
  {
    id: "deal_alignment",
    label: "Deal alignment",
    weight: 1.0,
    guidance:
      "Their expectation vs the deals Stryvia accepts: paid custom build, equity/revenue-share, or hybrid. Free-for-equity is only acceptable when they bring distribution or capital. 1 = expects a free build with nothing offered, or exclusivity/IP assignment from Stryvia; 3 = flexible but vague; 5 = explicitly aligned with an accepted deal type and realistic about budget.",
  },
  {
    id: "founder_signal",
    label: "Founder signal",
    weight: 1.0,
    guidance:
      "Clarity, responsiveness to the expansion ladder, realism. 1 = vague, resists every question, unrealistic; 3 = clear on today, cautious on tomorrow; 5 = precise, engages with the ladder critically (accepts some steps, rejects others with reasons), realistic on timeline and constraints.",
  },
];

export type RedFlagId =
  | "vague_ownership"
  | "regulated_without_licence"
  | "free_for_equity_nothing_offered"
  | "expects_exclusivity_or_ip"
  | "unrealistic_timeline"
  | "no_decision_maker_access";

export type RedFlag = {
  id: RedFlagId;
  label: string;
  guidance: string;
  /** A "hard" flag blocks `priority_call` and `productize` regardless of score. */
  hard: boolean;
};

export const RED_FLAGS: RedFlag[] = [
  {
    id: "vague_ownership",
    label: "Vague ownership of the idea",
    guidance:
      "The person cannot say whose idea or process this is, whether their employer or a client owns it, or contradicts themselves about it.",
    hard: true,
  },
  {
    id: "regulated_without_licence",
    label: "Regulated domain without licence or path to one",
    guidance:
      "Healthcare, finance/payments, insurance, legal practice, education credentials, pharma, or similar — and no licence, no licensed partner, and no credible path to one.",
    hard: true,
  },
  {
    id: "free_for_equity_nothing_offered",
    label: "Free build for equity with nothing else offered",
    guidance:
      "Expects Stryvia to build for equity alone while bringing no distribution, no capital, no clients and no unique data.",
    hard: false,
  },
  {
    id: "expects_exclusivity_or_ip",
    label: "Expects exclusivity or IP assignment from Stryvia",
    guidance:
      "Wants Stryvia to assign IP, sign exclusivity, or commit not to build similar things.",
    hard: true,
  },
  {
    id: "unrealistic_timeline",
    label: "Unrealistic timeline",
    guidance:
      "Expects a production system in days or a couple of weeks for something clearly larger, and does not adjust when asked.",
    hard: false,
  },
  {
    id: "no_decision_maker_access",
    label: "No decision-maker access",
    guidance:
      "Cannot sign or budget, and has no direct line to whoever can.",
    hard: false,
  },
];

export type Verdict = "productize" | "paid_build" | "priority_call" | "refer_or_pass";

export const VERDICT_LABELS: Record<Verdict, string> = {
  productize: "Productize — repeatable, Stryvia product candidate",
  paid_build: "Paid build — valuable one-off, custom build quote",
  priority_call: "Priority call — book a call with the team",
  refer_or_pass: "Refer or pass — polite decline, they keep their brief",
};

/** Thresholds used by `scoreToVerdict`. Weighted score is on a 1–5 scale. */
export const VERDICT_RULES = {
  priorityCall: { minWeighted: 3.8, minContribution: 4, minFounderSignal: 3 },
  productize: { minWeighted: 3.6, minRepeatability: 4, minFit: 3 },
  paidBuild: { minWeighted: 3.0, minPain: 4, minDealAlignment: 3 },
} as const;

export type DimensionScores = Record<RubricDimensionId, number>;

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Weighted average of the dimension scores on a 1–5 scale. */
export function weightedScore(scores: DimensionScores): number {
  let total = 0;
  let weight = 0;
  for (const d of RUBRIC_DIMENSIONS) {
    total += clampScore(scores[d.id]) * d.weight;
    weight += d.weight;
  }
  return weight === 0 ? 1 : Math.round((total / weight) * 100) / 100;
}

/**
 * Deterministic verdict from scores + triggered red flags (§5). The order of
 * evaluation matters: a hard red flag can never reach the two "warm" verdicts.
 */
export function scoreToVerdict(
  scores: DimensionScores,
  triggeredFlags: RedFlagId[],
): { verdict: Verdict; weighted: number; hardFlag: boolean } {
  const weighted = weightedScore(scores);
  const flags = new Set(triggeredFlags);
  const hardFlag = RED_FLAGS.some((f) => f.hard && flags.has(f.id));
  const s = (id: RubricDimensionId) => clampScore(scores[id]);

  if (!hardFlag) {
    const pc = VERDICT_RULES.priorityCall;
    if (
      weighted >= pc.minWeighted &&
      s("person_contribution") >= pc.minContribution &&
      s("founder_signal") >= pc.minFounderSignal
    ) {
      return { verdict: "priority_call", weighted, hardFlag };
    }
    const pr = VERDICT_RULES.productize;
    if (
      weighted >= pr.minWeighted &&
      s("market_repeatability") >= pr.minRepeatability &&
      s("stryvia_fit") >= pr.minFit
    ) {
      return { verdict: "productize", weighted, hardFlag };
    }
  }

  const pb = VERDICT_RULES.paidBuild;
  const freeForEquity = flags.has("free_for_equity_nothing_offered");
  if (
    !freeForEquity &&
    weighted >= pb.minWeighted &&
    s("pain_intensity") >= pb.minPain &&
    s("deal_alignment") >= pb.minDealAlignment
  ) {
    return { verdict: "paid_build", weighted, hardFlag };
  }

  return { verdict: "refer_or_pass", weighted, hardFlag };
}
