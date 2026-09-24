import { describe, expect, it } from "vitest";
import { scrubPayload } from "@/lib/lab/events";

describe("event payload scrubbing (PII-free by construction)", () => {
  it("drops unknown keys and anything that looks like an email or phone", () => {
    const out = scrubPayload({
      phase: "expand",
      email: "someone@example.com",
      to: "+966 50 123 4567",
      subject: "Contact nora@example.com please",
      note: "free text is not allowed",
      count: 3,
      reasons: ["a", "b", 1, { x: 1 }],
    });
    expect(out).toEqual({ phase: "expand", count: 3, reasons: ["a", "b", 1] });
  });
  it("returns null for empty input", () => {
    expect(scrubPayload(null)).toBeNull();
  });
});
