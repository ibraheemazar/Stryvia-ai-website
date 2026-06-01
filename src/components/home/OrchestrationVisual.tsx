import { getTranslations } from "next-intl/server";

// Scene 4 instrument visual: several model nodes converging into one output
// through Stryvia. Green only on the convergence point (D.2). Static SVG —
// calm, not spectacle.
export async function OrchestrationVisual() {
  const t = await getTranslations("home.scene4");
  const nodes = [
    { label: t("nodeScript"), y: 26 },
    { label: t("nodeStoryboard"), y: 72 },
    { label: t("nodeCopy"), y: 118 },
    { label: t("nodeAssets"), y: 164 },
  ];

  return (
    <div className="relative w-full">
      <svg viewBox="0 0 420 190" className="w-full" role="img" aria-label={t("nodeOutput")}>
        {/* converging lines */}
        {nodes.map((n, i) => (
          <path
            key={i}
            d={`M120 ${n.y} C 200 ${n.y}, 220 95, 300 95`}
            fill="none"
            stroke="var(--color-sv-line-strong)"
            strokeWidth="1"
          />
        ))}
        {/* output line */}
        <path d="M300 95 H392" stroke="var(--color-sv-green)" strokeWidth="1.5" />

        {/* input nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            <rect
              x="20"
              y={n.y - 13}
              width="100"
              height="26"
              rx="4"
              fill="var(--color-sv-surface-2)"
              stroke="var(--color-sv-line)"
            />
          </g>
        ))}

        {/* convergence point — Stryvia */}
        <circle cx="300" cy="95" r="7" fill="var(--color-sv-green)" />
        <circle cx="300" cy="95" r="13" fill="none" stroke="var(--color-sv-green-line)" strokeWidth="1" />
      </svg>

      {/* labels overlaid in mono so they switch font correctly */}
      <div className="pointer-events-none absolute inset-0">
        {nodes.map((n, i) => (
          <span
            key={i}
            className="sv-label-sm sv-label absolute -translate-y-1/2 text-sv-text-2"
            style={{ insetInlineStart: "5%", top: `${(n.y / 190) * 100}%` }}
          >
            {n.label}
          </span>
        ))}
        <span
          className="sv-label sv-label--live absolute -translate-y-1/2"
          style={{ insetInlineStart: "72%", top: "50%" }}
        >
          {t("nodeOrchestrate")}
        </span>
      </div>
    </div>
  );
}
