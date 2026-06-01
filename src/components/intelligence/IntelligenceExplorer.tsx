"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bracket } from "@/components/ui/Bracket";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// The "how it thinks" explorer (E.3). A scripted, illustrative walkthrough —
// not a live model call and not a reveal of the proprietary thinking model. The
// visitor steps forward and back; the focus-pull marks each transition.
export function IntelligenceExplorer() {
  const t = useTranslations("intelligence");
  const steps = t.raw("explorerSteps") as {
    label: string;
    title: string;
    text: string;
  }[];
  const [active, setActive] = useState(0);
  const atEnd = active === steps.length - 1;

  function go(next: number) {
    if (next < 0 || next >= steps.length) return;
    setActive(next);
    track("intelligence_explored", { step: next });
  }

  return (
    <div className="relative rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-6 sm:p-8">
      <Bracket live focusIn />

      <div className="flex items-center justify-between gap-4 border-b border-sv-line pb-4">
        <span className="sv-label">{t("explorerLabel")}</span>
        <span className="sv-label sv-label--live">{t("explorerSample")}</span>
      </div>

      {/* layer rail */}
      <div className="mt-6 flex gap-1.5" role="tablist" aria-label={t("explorerLabel")}>
        {steps.map((s, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            onClick={() => go(i)}
            className={cn(
              "h-1 flex-1 rounded-sv-pill transition-colors duration-300",
              i <= active ? "bg-sv-green" : "bg-sv-line-strong",
            )}
          >
            <span className="sr-only">{s.label}</span>
          </button>
        ))}
      </div>

      {/* active layer */}
      <div key={active} className="sv-reveal mt-8 min-h-[11rem]">
        <p className="sv-label sv-label--live">{steps[active].label}</p>
        <h3 className="mt-3 font-display text-sv-h2 text-sv-text">
          {steps[active].title}
        </h3>
        <p className="mt-3 max-w-xl text-sv-body text-sv-text-2">{steps[active].text}</p>
        {atEnd && (
          <p className="mt-5 font-mono text-sv-small uppercase tracking-[0.14em] text-sv-green">
            {t("explorerEnd")}
          </p>
        )}
      </div>

      {/* controls */}
      <div className="mt-6 flex items-center justify-between border-t border-sv-line pt-4">
        <button
          onClick={() => go(active - 1)}
          disabled={active === 0}
          className="font-mono text-sv-small uppercase tracking-[0.14em] text-sv-text-2 transition-colors hover:text-sv-text disabled:opacity-30"
        >
          ← {t("explorerPrev")}
        </button>
        <span className="sv-label">{`${active + 1} / ${steps.length}`}</span>
        <button
          onClick={() => go(active + 1)}
          disabled={atEnd}
          className="font-mono text-sv-small uppercase tracking-[0.14em] text-sv-green transition-opacity hover:opacity-80 disabled:opacity-30"
        >
          {t("explorerNext")} →
        </button>
      </div>
    </div>
  );
}
