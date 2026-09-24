import { describe, expect, it } from "vitest";
import { LAB_CONVERSATION } from "@/config/lab.config";
import { computeProgress, focusFor, nextPhase, type PhaseInput } from "@/lib/lab/phase";
import { SLOT_IDS, SLOT_META, emptyLadder, type SlotState } from "@/lib/lab/slots";

const quiet = {
  wants_to_finish: false,
  off_topic: false,
  abusive: false,
  sensitive_disclosure: false,
  injection_attempt: false,
  visitor_is_struggling: false,
};

function filled(ids: string[], confidence = 0.9): SlotState {
  const s: SlotState = {};
  for (const id of ids) {
    if (id === "expansion_reactions") continue;
    (s as Record<string, unknown>)[id] = { value: `v-${id}`, confidence, evidence: [], updated_turn: 1 };
  }
  return s;
}

const understandSlots = SLOT_IDS.filter((id) => SLOT_META[id].phase === "understand" && SLOT_META[id].required);
const commitSlots = SLOT_IDS.filter((id) => SLOT_META[id].phase === "commit" && SLOT_META[id].required);

function input(partial: Partial<PhaseInput>): PhaseInput {
  return { phase: "understand", slots: {}, turnCount: 1, turnsInPhase: 1, tokensUsed: 0, signals: quiet, strikes: 0, ...partial };
}

describe("phase controller", () => {
  it("moves intro to understand on the first turn", () => {
    const d = nextPhase(input({ phase: "intro" }));
    expect(d.phase).toBe("understand");
    expect(d.transitioned).toBe(true);
  });

  it("stays in understand while required slots are missing and targets the weakest first", () => {
    const slots = filled(understandSlots, 0.9);
    (slots as Record<string, { confidence: number }>).problem.confidence = 0.4;
    delete (slots as Record<string, unknown>).tools_in_use;
    const d = nextPhase(input({ slots, turnCount: 3, turnsInPhase: 3 }));
    expect(d.phase).toBe("understand");
    expect(d.focus).toContain("problem"); // below threshold → still targeted
    expect(d.focus).not.toContain("industry");
    expect(d.focus.indexOf("problem")).toBeGreaterThan(0); // empty slots come before a weak one
  });

  it("moves to expand once required understand slots are filled", () => {
    const d = nextPhase(input({ slots: filled(understandSlots), turnCount: 6, turnsInPhase: 6 }));
    expect(d.phase).toBe("expand");
    expect(d.reasons).toContain("understand_slots_filled");
    expect(d.focus).toEqual(["expansion_reactions"]);
  });

  it("caps understand at the configured number of turns", () => {
    const d = nextPhase(input({ slots: filled(["problem"]), turnCount: 14, turnsInPhase: LAB_CONVERSATION.maxTurnsUnderstand }));
    expect(d.phase).toBe("expand");
    expect(d.reasons).toContain("understand_turn_cap");
  });

  it("does not skip straight from understand to commit in one decision", () => {
    const slots = { ...filled(understandSlots), expansion_reactions: { ...emptyLadder(), automate: { reaction: "excited", quote: "x", turn_id: null }, intelligence: { reaction: "excited", quote: "x", turn_id: null }, productize: { reaction: "excited", quote: "x", turn_id: null }, scale: { reaction: "excited", quote: "x", turn_id: null } } } as SlotState;
    const d = nextPhase(input({ phase: "understand", slots, turnCount: 6, turnsInPhase: 6 }));
    expect(d.phase).toBe("expand");
  });

  it("moves expand to commit when all four ladder reactions are captured", () => {
    const slots: SlotState = {
      ...filled(understandSlots),
      expansion_reactions: {
        automate: { reaction: "excited", quote: "a", turn_id: null },
        intelligence: { reaction: "interested", quote: "b", turn_id: null },
        productize: { reaction: "skeptical", quote: "c", turn_id: null },
        scale: { reaction: "rejected", quote: "d", turn_id: null },
      },
    };
    const d = nextPhase(input({ phase: "expand", slots, turnCount: 10, turnsInPhase: 4 }));
    expect(d.phase).toBe("commit");
    expect(d.focus.length).toBeGreaterThan(0);
  });

  it("moves commit to review when commit slots are filled", () => {
    const d = nextPhase(input({ phase: "commit", slots: filled([...understandSlots, ...commitSlots]), turnCount: 20, turnsInPhase: 5 }));
    expect(d.phase).toBe("review");
    expect(d.focus).toEqual([]);
  });

  it("honours a finish request only with enough coverage, else flags it", () => {
    const early = nextPhase(input({ slots: filled(["problem"]), signals: { ...quiet, wants_to_finish: true } }));
    expect(early.phase).toBe("understand");
    expect(early.reasons).toContain("visitor_finish_too_early");
    const later = nextPhase(input({ phase: "expand", slots: filled([...understandSlots, "what_they_bring"]), signals: { ...quiet, wants_to_finish: true }, turnCount: 9, turnsInPhase: 2 }));
    expect(later.phase).toBe("review");
  });

  it("goes to review at the turn cap and the token cap", () => {
    expect(nextPhase(input({ turnCount: LAB_CONVERSATION.maxTurns })).phase).toBe("review");
    const d = nextPhase(input({ tokensUsed: LAB_CONVERSATION.tokenBudget }));
    expect(d.phase).toBe("review");
    expect(d.capReached).toBe("tokens");
  });

  it("terminates after repeated abuse", () => {
    const d = nextPhase(input({ signals: { ...quiet, abusive: true }, strikes: 2 }));
    expect(d.terminate).toBe(true);
    expect(d.phase).toBe("done");
    const first = nextPhase(input({ signals: { ...quiet, abusive: true }, strikes: 1 }));
    expect(first.terminate).toBe(false);
  });

  it("progress is monotone across phases and never exceeds 1", () => {
    const p0 = computeProgress("understand", {});
    const p1 = computeProgress("expand", filled(understandSlots));
    const p2 = computeProgress("review", filled([...understandSlots, ...commitSlots]));
    expect(p0).toBeLessThan(p1);
    expect(p1).toBeLessThan(p2);
    expect(p2).toBeLessThanOrEqual(1);
  });

  it("focus never includes a filled slot (never ask twice)", () => {
    const slots = filled(understandSlots.slice(0, 5));
    for (const id of focusFor("understand", slots)) expect(understandSlots.slice(0, 5)).not.toContain(id);
  });
});
