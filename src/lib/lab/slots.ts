// Universal slot backbone (brief §3). Every session, regardless of industry,
// fills the same 18 slots. Each slot holds a value, a confidence (0–1) and the
// evidence (quotes + turn refs) that produced it. Pure module — no I/O — so the
// phase controller and the tests can reason about it directly.

import { z } from "zod";
import { LAB_CONVERSATION, LAB_LADDER_STEPS, type LabLadderStep, type LabPhase } from "@/config/lab.config";

export const SLOT_IDS = [
  "problem",
  "affected_users",
  "current_process",
  "frequency_and_volume",
  "cost_of_status_quo",
  "attempts_so_far",
  "tools_in_use",
  "desired_outcome",
  "expansion_reactions",
  "what_they_bring",
  "expected_deal_type",
  "budget_range",
  "decision_maker",
  "timeline",
  "constraints_and_regulation",
  "industry",
  "geography",
  "competitors_or_alternatives",
] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export const SlotIdSchema = z.enum(SLOT_IDS);

/** Which phase is responsible for filling a slot, and whether it is required
 *  for the conversation to be considered complete (§3). */
export const SLOT_META: Record<
  SlotId,
  { phase: Exclude<LabPhase, "intro" | "review" | "done">; required: boolean; label: string }
> = {
  problem: { phase: "understand", required: true, label: "The problem" },
  affected_users: { phase: "understand", required: true, label: "Who suffers from it" },
  current_process: { phase: "understand", required: true, label: "Current process, step by step" },
  frequency_and_volume: { phase: "understand", required: true, label: "Frequency and volume" },
  cost_of_status_quo: { phase: "understand", required: true, label: "What it costs today" },
  attempts_so_far: { phase: "understand", required: true, label: "What they have tried" },
  tools_in_use: { phase: "understand", required: true, label: "Tools in use" },
  desired_outcome: { phase: "understand", required: true, label: "Desired outcome" },
  industry: { phase: "understand", required: true, label: "Industry" },
  geography: { phase: "understand", required: true, label: "Geography" },
  competitors_or_alternatives: {
    phase: "understand",
    required: false,
    label: "Competitors or alternatives",
  },
  expansion_reactions: { phase: "expand", required: true, label: "Reactions to the expansion ladder" },
  what_they_bring: { phase: "commit", required: true, label: "What they bring" },
  expected_deal_type: { phase: "commit", required: true, label: "Expected deal type" },
  budget_range: { phase: "commit", required: true, label: "Budget range" },
  decision_maker: { phase: "commit", required: true, label: "Who decides" },
  timeline: { phase: "commit", required: true, label: "Timeline and urgency" },
  constraints_and_regulation: {
    phase: "commit",
    required: true,
    label: "Constraints and regulation",
  },
};

export const LadderReactionSchema = z.enum([
  "excited",
  "interested",
  "neutral",
  "skeptical",
  "rejected",
]);
export type LadderReaction = z.infer<typeof LadderReactionSchema>;

export const EvidenceSchema = z.object({
  turn_id: z.string().nullable(),
  quote: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const LadderEntrySchema = z.object({
  reaction: LadderReactionSchema,
  quote: z.string(),
  turn_id: z.string().nullable(),
});
export type LadderEntry = z.infer<typeof LadderEntrySchema>;

export const ExpansionReactionsSchema = z.object({
  automate: LadderEntrySchema.nullable(),
  intelligence: LadderEntrySchema.nullable(),
  productize: LadderEntrySchema.nullable(),
  scale: LadderEntrySchema.nullable(),
});
export type ExpansionReactions = z.infer<typeof ExpansionReactionsSchema>;

export const SlotEntrySchema = z.object({
  value: z.string(),
  confidence: z.number(),
  evidence: z.array(EvidenceSchema),
  updated_turn: z.number().nullable(),
});
export type SlotEntry = z.infer<typeof SlotEntrySchema>;

export type SlotState = Partial<Record<Exclude<SlotId, "expansion_reactions">, SlotEntry>> & {
  expansion_reactions?: ExpansionReactions;
};

/** What the extractor is allowed to return (§4.2). Validated with zod before
 *  anything touches the state — never trust unvalidated model output. */
export const ExtractorDiffSchema = z.object({
  slot_updates: z.array(
    z.object({
      slot: z.enum(SLOT_IDS.filter((s) => s !== "expansion_reactions") as [SlotId, ...SlotId[]]),
      value: z.string(),
      confidence: z.number(),
      evidence: z.string(),
      /** true when the visitor corrected an earlier statement */
      retract: z.boolean(),
    }),
  ),
  ladder_reactions: z.array(
    z.object({
      step: z.enum(LAB_LADDER_STEPS),
      reaction: LadderReactionSchema,
      quote: z.string(),
    }),
  ),
  industry: z.string().nullable(),
  industry_confidence: z.number(),
  language_detected: z.enum(["en", "ar", "mixed", "other"]),
  signals: z.object({
    wants_to_finish: z.boolean(),
    off_topic: z.boolean(),
    abusive: z.boolean(),
    sensitive_disclosure: z.boolean(),
    injection_attempt: z.boolean(),
    visitor_is_struggling: z.boolean(),
    is_test_or_fictional: z.boolean(),
    no_contact_requested: z.boolean(),
    demands_decision: z.boolean(),
  }),
});
export type ExtractorDiff = z.infer<typeof ExtractorDiffSchema>;

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function emptyLadder(): ExpansionReactions {
  return { automate: null, intelligence: null, productize: null, scale: null };
}

/**
 * Merge an extractor diff into the slot state. Rules:
 * - a higher confidence always wins; an equal/lower confidence only appends evidence
 * - `retract: true` replaces the value even at lower confidence (the visitor corrected themselves)
 * - ladder reactions are keyed by step; a later reaction overrides an earlier one
 * Returns a new object; never mutates the input.
 */
export function mergeSlotDiff(
  state: SlotState,
  diff: ExtractorDiff,
  turn: { id: string; index: number },
): SlotState {
  const next: SlotState = { ...state };

  for (const u of diff.slot_updates) {
    const slot = u.slot as Exclude<SlotId, "expansion_reactions">;
    const conf = clamp01(u.confidence);
    const value = u.value.trim().slice(0, 2000);
    if (!value) continue;
    const evidence: Evidence = { turn_id: turn.id, quote: u.evidence.trim().slice(0, 400) };
    const prev = next[slot];

    if (!prev || u.retract || conf > prev.confidence) {
      next[slot] = {
        value,
        confidence: conf,
        evidence: [...(prev?.evidence ?? []), evidence].slice(-6),
        updated_turn: turn.index,
      };
    } else {
      next[slot] = {
        ...prev,
        evidence: [...prev.evidence, evidence].slice(-6),
      };
    }
  }

  if (diff.ladder_reactions.length > 0) {
    const ladder: ExpansionReactions = { ...(next.expansion_reactions ?? emptyLadder()) };
    for (const r of diff.ladder_reactions) {
      ladder[r.step] = { reaction: r.reaction, quote: r.quote.trim().slice(0, 400), turn_id: turn.id };
    }
    next.expansion_reactions = ladder;
  }

  if (diff.industry && clamp01(diff.industry_confidence) > 0) {
    const conf = clamp01(diff.industry_confidence);
    const prev = next.industry;
    if (!prev || conf >= prev.confidence) {
      next.industry = {
        value: diff.industry.trim().slice(0, 200),
        confidence: conf,
        evidence: prev?.evidence ?? [],
        updated_turn: turn.index,
      };
    }
  }

  return next;
}

/** Confidence of a slot, treating the ladder as coverage of its four steps. */
export function slotConfidence(state: SlotState, slot: SlotId): number {
  if (slot === "expansion_reactions") {
    const l = state.expansion_reactions;
    if (!l) return 0;
    const n = LAB_LADDER_STEPS.filter((s) => l[s]).length;
    return n / LAB_LADDER_STEPS.length;
  }
  return state[slot]?.confidence ?? 0;
}

export function isSlotFilled(
  state: SlotState,
  slot: SlotId,
  threshold: number = LAB_CONVERSATION.slotConfidenceThreshold,
): boolean {
  if (slot === "expansion_reactions") return slotConfidence(state, slot) >= 0.999;
  return slotConfidence(state, slot) >= threshold;
}

/** Slots of a phase that are still empty or below threshold, weakest first. */
export function missingSlots(
  state: SlotState,
  phase: LabPhase,
  opts?: { requiredOnly?: boolean; threshold?: number },
): SlotId[] {
  return SLOT_IDS.filter((id) => {
    const meta = SLOT_META[id];
    if (meta.phase !== phase) return false;
    if (opts?.requiredOnly && !meta.required) return false;
    return !isSlotFilled(state, id, opts?.threshold);
  }).sort((a, b) => slotConfidence(state, a) - slotConfidence(state, b));
}

export function missingLadderSteps(state: SlotState): LabLadderStep[] {
  const l = state.expansion_reactions;
  return LAB_LADDER_STEPS.filter((s) => !l || !l[s]);
}

/** 0–1 coverage of all required slots, weighted equally. */
export function requiredCoverage(state: SlotState, threshold?: number): number {
  const required = SLOT_IDS.filter((id) => SLOT_META[id].required);
  if (required.length === 0) return 1;
  const filled = required.filter((id) => isSlotFilled(state, id, threshold)).length;
  return filled / required.length;
}

/** Compact, human-readable rendering of the state for prompts (not for UI). */
export function describeState(state: SlotState): string {
  const lines: string[] = [];
  for (const id of SLOT_IDS) {
    if (id === "expansion_reactions") {
      const l = state.expansion_reactions;
      if (!l) continue;
      for (const step of LAB_LADDER_STEPS) {
        const e = l[step];
        if (e) lines.push(`- ladder.${step}: ${e.reaction} — "${e.quote}"`);
      }
      continue;
    }
    const e = state[id];
    if (!e) continue;
    lines.push(`- ${id} (confidence ${e.confidence.toFixed(2)}): ${e.value}`);
  }
  return lines.length ? lines.join("\n") : "(nothing captured yet)";
}
