import { describe, expect, it } from "vitest";
import { RUBRIC_DIMENSIONS, scoreToVerdict, weightedScore, type DimensionScores } from "@/config/lab-rubric.config";

function scores(n: number, overrides: Partial<DimensionScores> = {}): DimensionScores {
  const s = Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d.id, n])) as DimensionScores;
  return { ...s, ...overrides };
}

describe("rubric scoring", () => {
  it("weighted score is on a 1–5 scale and clamps garbage", () => {
    expect(weightedScore(scores(5))).toBe(5);
    expect(weightedScore(scores(1))).toBe(1);
    expect(weightedScore(scores(99))).toBe(5);
    expect(weightedScore(scores(Number.NaN))).toBe(1);
  });

  it("priority_call needs a strong person and a strong overall score", () => {
    expect(scoreToVerdict(scores(4, { person_contribution: 5 }), []).verdict).toBe("priority_call");
    expect(scoreToVerdict(scores(4, { person_contribution: 3 }), []).verdict).not.toBe("priority_call");
  });

  it("productize needs repeatability and fit", () => {
    const v = scoreToVerdict(scores(4, { person_contribution: 2, market_repeatability: 5, stryvia_fit: 4 }), []);
    expect(v.verdict).toBe("productize");
    expect(scoreToVerdict(scores(4, { person_contribution: 2, market_repeatability: 2 }), []).verdict).not.toBe("productize");
  });

  it("paid_build needs real pain and deal alignment", () => {
    const v = scoreToVerdict(scores(3, { pain_intensity: 5, deal_alignment: 4, market_repeatability: 1 }), []);
    expect(v.verdict).toBe("paid_build");
  });

  it("falls back to refer_or_pass on weak scores", () => {
    expect(scoreToVerdict(scores(2), []).verdict).toBe("refer_or_pass");
  });

  it("a hard red flag blocks the warm verdicts", () => {
    const r = scoreToVerdict(scores(5), ["expects_exclusivity_or_ip"]);
    expect(r.hardFlag).toBe(true);
    expect(["paid_build", "refer_or_pass"]).toContain(r.verdict);
    expect(scoreToVerdict(scores(5), ["regulated_without_licence"]).verdict).not.toBe("priority_call");
  });

  it("free-for-equity with nothing offered cannot become a paid build", () => {
    const r = scoreToVerdict(scores(3, { pain_intensity: 5, deal_alignment: 3, person_contribution: 1 }), ["free_for_equity_nothing_offered"]);
    expect(r.verdict).toBe("refer_or_pass");
  });
});
