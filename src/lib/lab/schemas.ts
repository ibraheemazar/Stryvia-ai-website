// Zod schemas for every structured model output in the Lab (brief §4). Kept
// free of `.min()/.max()` constraints so they translate cleanly to the
// structured-output JSON schema; ranges are clamped in code after parsing.

import { z } from "zod";

export const IndustryLensSchema = z.object({
  industry: z.string(),
  summary: z.string(),
  stakeholders: z.array(z.string()),
  regulations_and_licences: z.array(z.string()),
  data_sensitivity: z.string(),
  money_flows: z.string(),
  incumbent_tools: z.array(z.string()),
  what_scale_looks_like: z.string(),
  typical_pitfalls: z.array(z.string()),
});
export type IndustryLens = z.infer<typeof IndustryLensSchema>;

export const RollingSummarySchema = z.object({
  summary: z.string(),
  key_quotes: z.array(z.string()),
});

// "Scope at a glance": what the visitor confirmed, what they excluded, what
// the AI assumed (labelled as such) and what remains unknown. Lets the reviewer
// scan the boundaries of the idea without reading every section.
export const BriefScopeSchema = z.object({
  confirmed: z.array(z.string()),
  excluded: z.array(z.string()),
  assumptions: z.array(z.string()),
  open_questions: z.array(z.string()),
});
export type BriefScope = z.infer<typeof BriefScopeSchema>;

export const BriefSchema = z.object({
  title: z.string(),
  one_line: z.string(),
  what_you_came_with: z.object({
    problem: z.string(),
    who_is_affected: z.string(),
    current_process: z.array(z.string()),
    frequency_and_volume: z.string(),
    cost_today: z.string(),
    tried_so_far: z.string(),
    tools: z.string(),
    desired_outcome: z.string(),
  }),
  // Possibilities explored. Each ladder step is null when it was not relevant
  // to this idea (an internal tool is not forced through productization).
  // `honest_ceiling_note` holds neutral considerations and open questions for
  // the reviewer — never a judgment of the opportunity.
  what_it_could_become: z.object({
    intro: z.string(),
    automate: z.string().nullable(),
    add_intelligence: z.string().nullable(),
    productize: z.string().nullable(),
    scale: z.string().nullable(),
    honest_ceiling_note: z.string(),
  }),
  what_you_bring: z.array(z.string()),
  what_you_expect: z.string(),
  constraints: z.string(),
  scope: BriefScopeSchema,
  next_step_note: z.string(),
});
export type Brief = z.infer<typeof BriefSchema>;

/** Briefs saved before the scope block existed have no `scope`; fill it in. */
export const StoredBriefSchema = BriefSchema.extend({ scope: BriefScopeSchema.optional() });

export const EMPTY_SCOPE: BriefScope = { confirmed: [], excluded: [], assumptions: [], open_questions: [] };

export function normalizeBrief(content: unknown): Brief {
  const parsed = StoredBriefSchema.parse(content);
  return { ...parsed, scope: parsed.scope ?? EMPTY_SCOPE };
}

export const DimensionScoreSchema = z.object({
  score: z.number(),
  evidence: z.array(z.string()),
  note: z.string(),
});

export const AssessmentSchema = z.object({
  scores: z.object({
    market_repeatability: DimensionScoreSchema,
    pain_intensity: DimensionScoreSchema,
    stryvia_fit: DimensionScoreSchema,
    effort_vs_value: DimensionScoreSchema,
    person_contribution: DimensionScoreSchema,
    deal_alignment: DimensionScoreSchema,
    founder_signal: DimensionScoreSchema,
  }),
  red_flags: z.array(
    z.object({
      id: z.enum([
        "vague_ownership",
        "regulated_without_licence",
        "free_for_equity_nothing_offered",
        "expects_exclusivity_or_ip",
        "unrealistic_timeline",
        "no_decision_maker_access",
      ]),
      triggered: z.boolean(),
      evidence: z.string(),
    }),
  ),
  model_verdict: z.enum(["productize", "paid_build", "priority_call", "refer_or_pass"]),
  confidence: z.number(),
  reasoning: z.string(),
  why_lines: z.array(z.string()),
  manipulation_detected: z.boolean(),
  proposed_plan: z.object({
    what_stryvia_could_build: z.string(),
    rough_scope: z.string(),
    suggested_deal_shape: z.string(),
    open_questions: z.array(z.string()),
  }),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const DecisionEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export const JudgeSchema = z.object({
  promises_or_inflation: z.object({ found: z.boolean(), quotes: z.array(z.string()) }),
  impersonation: z.object({ found: z.boolean(), quotes: z.array(z.string()) }),
  pricing_or_timeline: z.object({ found: z.boolean(), quotes: z.array(z.string()) }),
  ladder_offered: z.boolean(),
  repeated_questions: z.object({ found: z.boolean(), examples: z.array(z.string()) }),
  language_respected: z.boolean(),
  verdict_defensible: z.object({ defensible: z.boolean(), reason: z.string() }),
  overall_quality_1_5: z.number(),
  notes: z.string(),
});
export type JudgeResult = z.infer<typeof JudgeSchema>;
