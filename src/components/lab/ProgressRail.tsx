"use client";

import { useTranslations } from "next-intl";
import type { LabPhase } from "./lab-client";

// Visible progress (brief §2 UX): phase + rough completion, always in view on
// a phone. Mirrors in RTL through `transform-origin: start` (sv-progress).
export function ProgressRail({ phase, progress }: { phase: LabPhase; progress: number }) {
  const t = useTranslations("lab.session");
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="flex items-center gap-4" role="group" aria-label={t("progress", { percent: pct })}>
      <span className="sv-label sv-label--live whitespace-nowrap">{t(`phase.${phase}`)}</span>
      <div className="relative h-px flex-1 bg-sv-line-strong" aria-hidden>
        <div
          className="sv-progress absolute inset-y-0 start-0 bg-sv-green transition-[width] duration-500 ease-sv"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-sv-label text-sv-text-3 tabular-nums" aria-hidden>
        <bdi>{pct}%</bdi>
      </span>
    </div>
  );
}
