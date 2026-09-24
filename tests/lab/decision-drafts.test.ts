import { describe, expect, it } from "vitest";
import { fallbackDraft } from "@/lib/lab/prompts/decision";
import { lintAssistantText } from "@/lib/lab/guardrails";

describe("decision email fallbacks", () => {
  const actions = ["book_call", "request_quote", "decline"] as const;
  const langs = ["en", "ar"] as const;

  it.each(actions.flatMap((a) => langs.map((l) => [a, l] as const)))("%s / %s never promises, prices or impersonates", (action, language) => {
    const d = fallbackDraft({ action, language, visitorFirstName: "Nora", briefTitle: "Faster office", schedulingUrl: "https://cal.com/x" });
    expect(d.subject.length).toBeGreaterThan(3);
    expect(d.body).toContain("Nora");
    expect(lintAssistantText(d.body)).toEqual([]);
    expect(d.body).not.toMatch(/score|verdict|assess/i);
    if (language === "ar") expect(d.body).toMatch(/[؀-ۿ]/);
  });

  it("book_call includes the scheduling link when present, asks for times otherwise", () => {
    expect(fallbackDraft({ action: "book_call", language: "en", visitorFirstName: "N", briefTitle: "T", schedulingUrl: "https://cal.com/x" }).body).toContain("https://cal.com/x");
    expect(fallbackDraft({ action: "book_call", language: "en", visitorFirstName: "N", briefTitle: "T", schedulingUrl: null }).body).toMatch(/two times/i);
  });
});
