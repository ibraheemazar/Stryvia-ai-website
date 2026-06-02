"use client";

import { useEffect, useRef } from "react";
import { onScrollProgress, reducedMotion } from "@/lib/scroll";

// Moves its children on a different rate than the scroll, creating depth.
// `speed` > 0 drifts up as you scroll past (background feel); negative drifts
// the other way. Translation is scroll-linked and GPU-composited.
export function Parallax({
  children,
  speed = 30,
  className,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    el.style.willChange = "transform";
    return onScrollProgress(el, (p) => {
      const y = (p - 0.5) * -2 * speed;
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    });
  }, [speed]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
