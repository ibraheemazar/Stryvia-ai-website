import { getTranslations } from "next-intl/server";
import { Bracket } from "@/components/ui/Bracket";

// The worked example the spec anchors the moat on (§6): one brief fans out into
// several crafts working in parallel, then converges into one coherent result —
// "many models as one." Server-rendered, on-brand (hairlines, one green signal),
// RTL-safe via logical properties. The flow direction reads start→end, so it
// mirrors automatically in Arabic.
export async function OrchestrationStoryboard() {
  const t = await getTranslations("intelligence.storyboard");
  const lanes = t.raw("lanes") as string[];

  return (
    <div className="relative overflow-hidden rounded-sv-lg border border-sv-line bg-sv-surface-2/40 p-6 sm:p-8">
      <Bracket />
      <div className="flex items-center justify-between gap-4 border-b border-sv-line pb-4">
        <span className="sv-label">{t("label")}</span>
        <span className="sv-label sv-label--live">{t("tag")}</span>
      </div>

      <div className="mt-8 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* The brief */}
        <div className="relative rounded-sv-md border border-sv-line bg-sv-base/60 p-5">
          <p className="sv-label-sm sv-label">{t("briefLabel")}</p>
          <p className="mt-3 text-sv-body text-sv-text">{t("brief")}</p>
        </div>

        {/* Parallel craft lanes */}
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 start-0 hidden w-px bg-sv-green-line lg:block"
            aria-hidden
          />
          <ul className="space-y-2">
            {lanes.map((lane, i) => (
              <li
                key={lane}
                className="flex items-center gap-3 rounded-sv-sm border border-sv-line bg-sv-surface-1 px-3 py-2 text-sv-small text-sv-text-2"
                style={{ ["--i" as string]: i } as React.CSSProperties}
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
          <p className="mt-3 text-sv-body text-sv-text">{t("result")}</p>
          {/* a tiny assembled-timeline motif */}
          <div className="mt-4 flex gap-1" aria-hidden>
            {lanes.map((lane, i) => (
              <span
                key={lane}
                className="h-1 flex-1 rounded-sv-pill"
                style={{
                  background: "var(--color-sv-green)",
                  opacity: 0.4 + (i / Math.max(1, lanes.length - 1)) * 0.6,
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
