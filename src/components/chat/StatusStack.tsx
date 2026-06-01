"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// The focus-pull status stack (A.8): calm mono lines stream one at a time —
// "Understanding the problem", "Mapping the approach", "Shaping the solution".
// No spinner, no fake percentage. This is the proof, not a loader.
export function StatusStack() {
  const t = useTranslations("chat.status");
  const lines = [t("understanding"), t("mapping"), t("shaping")];
  const [shown, setShown] = useState(1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShown(2), 650),
      setTimeout(() => setShown(3), 1300),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col gap-2 py-2" aria-live="polite">
      {lines.slice(0, shown).map((line, i) => (
        <div
          key={i}
          className="sv-reveal flex items-center gap-2.5"
          style={{ ["--i" as string]: i }}
        >
          <span className="sv-live-dot" />
          <span className="sv-label sv-label--live">{line}</span>
        </div>
      ))}
    </div>
  );
}
