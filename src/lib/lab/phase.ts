// Deterministic phase controller (brief §4.3). Code — not the model — decides
// when the conversation moves on, based on slot completeness thresholds and
// the visitor's intent. Pure function: same input, same output; fully tested.

import { LAB_CONVERSATION, type LabPhase } from "@/config/lab.config";
import {
  missingLadderSteps,
  missingSlots,
  requiredCoverage,
  type SlotId,
  type SlotState,
} from "./slots";

export type PhaseSignals = {
  wants_to_finish: boolean;
  off_topic: boolean;
  abusive: boolean;
  sensitive_disclosure: boolean;
  injection_attempt: boolean;
  visitor_is_struggling: boolean;
};

export type PhaseInput = {
  phase: LabPhase;
  slots: SlotState;
  /** Visitor turns so far, including the current one. */
  turnCount: number;
  /** Visitor turns spent inside the current phase, including the current one. */
  turnsInPhase: number;
  tokensUsed: number;
  signals: PhaseSignals;
  /** Consecutive abusive/off-topic turns (tracked by the caller). */
  strikes: number;
  config?: typeof LAB_CONVERSATION;
};

export type PhaseDecision = {
  phase: LabPhase;
  /** true when the phase changed in this decision */
  transitioned: boolean;
  /** Ordered list of what the interviewer should target next. */
  focus: SlotId[];
  /** 0–1 rough completion shown to the visitor. */
  progress: number;
  /** Interviewer should offer the "wrap up" option because we hit a cap. */
  capReached: "turns" | "tokens" | null;
  /** The session must end now (abuse) — the interviewer says a graceful goodbye. */
  terminate: boolean;
  /** Reasons, for logs and tests. */
  reasons: string[];
};

const PHASE_WEIGHT: Record<LabPhase, number> = {
  intro: 0,
  understand: 0.1,
  expand: 0.55,
  commit: 0.75,
  review: 0.95,
  done: 1,
};

export function computeProgress(phase: LabPhase, slots: SlotState): number {
  const coverage = requiredCoverage(slots);
  // Coverage contributes up to 0.9; the phase floor makes sure the bar always
  // moves forward when a phase changes even if slots are weak.
  const p = Math.max(PHASE_WEIGHT[phase], 0.05 + coverage * 0.9);
  return Math.min(1, Math.round(p * 100) / 100);
}

export function nextPhase(input: PhaseInput): PhaseDecision {
  const cfg = input.config ?? LAB_CONVERSATION;
  const reasons: string[] = [];
  let phase = input.phase;
  const start = phase;

  // Abuse: two consecutive abusive turns end the session (§4.6).
  if (input.signals.abusive && input.strikes >= 2) {
    return {
      phase: "done",
      transitioned: start !== "done",
      focus: [],
      progress: computeProgress("done", input.slots),
      capReached: null,
      terminate: true,
      reasons: ["abusive_repeat"],
    };
  }

  const tokenCap = input.tokensUsed >= cfg.tokenBudget;
  const turnCap = input.turnCount >= cfg.maxTurns;
  const capReached: PhaseDecision["capReached"] = tokenCap ? "tokens" : turnCap ? "turns" : null;

  if (phase === "intro") {
    phase = "understand";
    reasons.push("intro_complete");
  }

  if (phase === "understand") {
    const missingRequired = missingSlots(input.slots, "understand", { requiredOnly: true });
    if (missingRequired.length === 0) {
      phase = "expand";
      reasons.push("understand_slots_filled");
    } else if (input.turnsInPhase >= cfg.maxTurnsUnderstand) {
      phase = "expand";
      reasons.push("understand_turn_cap");
    }
  }

  if (phase === "expand" && start !== "understand") {
    // Only evaluate expand→commit when we *entered* this decision in expand;
    // a fresh transition into expand should get its first turn.
    if (missingLadderSteps(input.slots).length === 0) {
      phase = "commit";
      reasons.push("ladder_complete");
    } else if (input.turnsInPhase >= cfg.maxTurnsExpand) {
      phase = "commit";
      reasons.push("expand_turn_cap");
    }
  }

  if (phase === "commit" && start === "commit") {
    const missingRequired = missingSlots(input.slots, "commit", { requiredOnly: true });
    if (missingRequired.length === 0) {
      phase = "review";
      reasons.push("commit_slots_filled");
    } else if (input.turnsInPhase >= cfg.maxTurnsCommit) {
      phase = "review";
      reasons.push("commit_turn_cap");
    }
  }

  // Visitor wants to stop: honour it once there is enough to write a brief,
  // otherwise let the interviewer nudge once (the caller tracks the nudge).
  if (input.signals.wants_to_finish && phase !== "review" && phase !== "done") {
    if (requiredCoverage(input.slots) >= cfg.minCoverageForEarlyFinish) {
      phase = "review";
      reasons.push("visitor_finish");
    } else {
      reasons.push("visitor_finish_too_early");
    }
  }

  // Hard caps: go to review with whatever exists.
  if (capReached && phase !== "review" && phase !== "done") {
    phase = "review";
    reasons.push(`cap_${capReached}`);
  }

  const focus = focusFor(phase, input.slots);

  return {
    phase,
    transitioned: phase !== start,
    focus,
    progress: computeProgress(phase, input.slots),
    capReached,
    terminate: false,
    reasons,
  };
}

/** What to ask about next: required gaps first, then optional, then nothing. */
export function focusFor(phase: LabPhase, slots: SlotState): SlotId[] {
  if (phase === "understand" || phase === "commit") {
    const required = missingSlots(slots, phase, { requiredOnly: true });
    const optional = missingSlots(slots, phase).filter((s) => !required.includes(s));
    return [...required, ...optional].slice(0, 4);
  }
  if (phase === "expand") {
    return missingLadderSteps(slots).length ? ["expansion_reactions"] : [];
  }
  return [];
}
