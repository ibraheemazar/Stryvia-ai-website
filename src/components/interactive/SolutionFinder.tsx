"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChat } from "@/components/chat/ChatProvider";
import { Bracket } from "@/components/ui/Bracket";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// The Solution Finder (E.1): a three-step focus sequence that ends in a Chat
// seeded with everything gathered, so the first response is immediately sharp.
// Navigation is pure config — no model call needed to move through it.
export function SolutionFinder() {
  const t = useTranslations("solutionFinder");
  const { open, send } = useChat();
  const audiences = t.raw("audiences") as string[];
  const intents = t.raw("intents") as string[];

  const [step, setStep] = useState(0);
  const [audience, setAudience] = useState<string | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [situation, setSituation] = useState("");

  function go(next: number) {
    setStep(next);
    if (next === 0) track("solution_finder_started");
  }

  function finish() {
    track("solution_finder_completed", { audience, intent });
    const seed = [
      audience && `I'm ${audience.toLowerCase()}.`,
      intent && `I want to: ${intent}.`,
      situation && `Situation: ${situation}`,
    ]
      .filter(Boolean)
      .join(" ");
    void send(seed || "Help me find where to start.");
    open({ pageContext: `solution finder: ${audience} / ${intent}` });
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-sv-pill border px-4 py-2 text-sv-small transition-colors duration-200",
      active
        ? "border-sv-green-line bg-sv-green-soft text-sv-green"
        : "border-sv-line text-sv-text-2 hover:border-sv-green-line hover:text-sv-text",
    );

  return (
    <div className="relative rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-6 sm:p-8">
      <Bracket live focusIn />

      <div className="mb-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-sv-pill transition-colors duration-300",
              i <= step ? "bg-sv-green" : "bg-sv-line-strong",
            )}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="sv-reveal">
          <p className="sv-label sv-label--live">{`01 — ${t("step1")}`}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {audiences.map((a) => (
              <button
                key={a}
                onClick={() => {
                  setAudience(a);
                  go(1);
                }}
                className={chip(audience === a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="sv-reveal">
          <p className="sv-label sv-label--live">{`02 — ${t("step2")}`}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {intents.map((a) => (
              <button
                key={a}
                onClick={() => {
                  setIntent(a);
                  go(2);
                }}
                className={chip(intent === a)}
              >
                {a}
              </button>
            ))}
          </div>
          <button onClick={() => go(0)} className="mt-6 text-sv-small text-sv-text-3 hover:text-sv-text">
            ← {t("back")}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="sv-reveal">
          <p className="sv-label sv-label--live">{`03 — ${t("step3")}`}</p>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder={t("step3Placeholder")}
            className="mt-5 min-h-24 w-full resize-none rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-sv-body text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
          />
          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => go(1)} className="text-sv-small text-sv-text-3 hover:text-sv-text">
              ← {t("back")}
            </button>
            <Button variant="primary" onClick={finish}>
              {t("talk")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
