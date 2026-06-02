"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bracket } from "@/components/ui/Bracket";
import { cn } from "@/lib/utils";

// The worked orchestration example the spec anchors the moat on (§6): one brief
// fans out into several crafts working in parallel, then converges into one
// coherent result — "many models as one." Switchable across domains so the
// breadth is demonstrated, not asserted: the same orchestration shape holds
// whether the brief is a product, a campaign, a film, or a research study.
//
// On-brand (hairlines, one green signal), RTL-safe via logical properties; the
// flow reads start→end so it mirrors automatically in Arabic.

type Example = {
  tab: string;
  brief: string;
  lanes: string[];
  result: string;
};

export function OrchestrationStoryboard() {
  const t = useTranslations("intelligence.storyboard");
  const examples = t.raw("examples") as Example[];
  const [active, setActive] = useState(0);
  const ex = examples[active];

  return (
    <div className="relative overflow-hidden rounded-sv-lg border border-sv-line bg-sv-surface-2/40 p-6 sm:p-8">
      <Bracket />
      <div className="flex items-center justify-between gap-4 border-b border-sv-line pb-4">
        <span className="sv-label">{t("label")}</span>
        <span className="sv-label sv-label--live">{t("tag")}</span>
      </div>

      {/* Domain switcher — proves the same shape holds across any problem */}
      <div className="mt-6">
        <p className="sv-label-sm sv-label mb-3">{t("switchHint")}</p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("switchHint")}>
          {examples.map((e, i) => (
            <button
              key={e.tab}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-sv-pill border px-4 py-1.5 text-sv-small transition-colors duration-200",
                i === active
                  ? "border-sv-green-line bg-sv-green-soft text-sv-green"
                  : "border-sv-line text-sv-text-2 hover:border-sv-line-strong hover:text-sv-text",
              )}
            >
              {e.tab}
            </button>
          ))}
        </div>
      </div>

      <div
        key={active}
        className="sv-reveal is-visible mt-8 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]"
      >
        {/* The brief */}
        <div className="relative rounded-sv-md border border-sv-line bg-sv-base/60 p-5">
          <p className="sv-label-sm sv-label">{t("briefLabel")}</p>
          <p className="mt-3 text-sv-body text-sv-text">{ex.brief}</p>
        </div>

        {/* Parallel craft lanes */}
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 start-0 hidden w-px bg-sv-green-line lg:block"
            aria-hidden
          />
          <ul className="space-y-2">
            {ex.lanes.map((lane) => (
              <li
                key={lane}
                className="flex items-center gap-3 rounded-sv-sm border border-sv-line bg-sv-surface-1 px-3 py-2 text-sv-small text-sv-text-2"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sv-green" aria-hidden />
                {lane}
              </li>
            ))}
          </ul>
        </div>

        {/* One coherent result */}
        <div className="relative rounded-sv-md border border-sv-green-line bg-sv-surface-2 p-5 sv-glow">
          <Bracket live />
          <p className="sv-label-sm sv-label sv-label--live">{t("resultLabel")}</p>
          <p className="mt-3 text-sv-body text-sv-text">{ex.result}</p>
          {/* a tiny assembled-timeline motif */}
          <div className="mt-4 flex gap-1" aria-hidden>
            {ex.lanes.map((lane, i) => (
              <span
                key={lane}
                className="h-1 flex-1 rounded-sv-pill"
                style={{
                  background: "var(--color-sv-green)",
                  opacity: 0.4 + (i / Math.max(1, ex.lanes.length - 1)) * 0.6,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-sv-small text-sv-text-3">{t("note")}</p>
    </div>
  );
}
