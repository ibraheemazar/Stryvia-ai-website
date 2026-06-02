"use client";

import { useEffect, useRef } from "react";
import { onScrollProgress, reducedMotion } from "@/lib/scroll";
import { cn } from "@/lib/utils";

// A scroll-linked stage: as the element travels through the viewport it eases
// from entering → settled → leaving. We map progress to opacity, a vertical
// rise, and a slight scale so big statements "breathe" as you scroll — the
// cinematic centering effect, peaking when the element is mid-viewport.
export function ScrollScene({
  children,
  className,
  rise = 60,
  scaleFrom = 0.94,
  fade = true,
}: {
  children: React.ReactNode;
  className?: string;
  rise?: number;
  scaleFrom?: number;
  fade?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      el.style.opacity = "1";
      el.style.transform = "none";
      return;
    }
    el.style.willChange = "transform, opacity";
    // When not fading, reveal immediately (the wrapper starts at opacity 0 so
    // there's no flash before JS, and to stay safe if JS never runs).
    if (!fade) el.style.opacity = "1";
    return onScrollProgress(el, (p) => {
      // Bell curve: 0 at edges, 1 at center.
      const centered = 1 - Math.min(1, Math.abs(p - 0.5) / 0.5);
      const eased = centered * centered * (3 - 2 * centered); // smoothstep
      const y = (1 - eased) * rise * (p < 0.5 ? 1 : -0.4);
      const scale = scaleFrom + (1 - scaleFrom) * eased;
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      if (fade) el.style.opacity = (0.25 + 0.75 * eased).toFixed(3);
    });
  }, [rise, scaleFrom, fade]);

  return (
    <div ref={ref} className={cn("sv-scene", className)}>
      {children}
    </div>
  );
}
