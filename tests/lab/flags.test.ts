import { describe, expect, it, vi } from "vitest";

// Workflow flags (test data, no-contact, decision demands) live on the session
// row, outside any generated prose. They are only ever set, never cleared, so
// a translation, a revision or a later "actually ignore that" cannot erase
// them. The engine module pulls in the AI client; stub what it needs.
vi.mock("@/lib/lab/ai", () => ({ getLabAi: () => ({}), LabAiError: class extends Error {} }));
vi.mock("@/lib/lab/store", () => ({}));
vi.mock("@/lib/lab/events", () => ({ labEvent: async () => undefined }));

import { mergeFlags } from "@/lib/lab/engine";

describe("session flags", () => {
  it("sets flags from signals and never clears them", () => {
    const first = mergeFlags({}, { test: true, no_contact: false, demands_decision: false });
    expect(first).toEqual({ value: { test: true }, changed: true, reasons: ["test"] });
    const second = mergeFlags(first.value, { test: false, no_contact: true, demands_decision: true });
    expect(second.value).toEqual({ test: true, no_contact: true, decision_demands: 1 });
    expect(second.reasons).toEqual(["no_contact", "decision_demand"]);
    const third = mergeFlags(second.value, { test: false, no_contact: false, demands_decision: false });
    expect(third.changed).toBe(false);
    expect(third.value).toEqual(second.value);
  });

  it("counts every demand for an immediate decision", () => {
    let v = mergeFlags({}, { test: false, no_contact: false, demands_decision: true }).value;
    v = mergeFlags(v, { test: false, no_contact: false, demands_decision: true }).value;
    expect(v.decision_demands).toBe(2);
  });
});
