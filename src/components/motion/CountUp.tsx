"use client";

import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/scroll";

// Counts a number up when it first scrolls into view. `prefix`/`suffix` wrap it
// (e.g. "≈ ", " weeks"). Respects reduced-motion by showing the final value.
export function CountUp({
  to,
  duration = 1400,
  prefix = "",
  suffix = "",
  locale,
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      setValue(to);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !done.current) {
          done.current = true;
          io.disconnect();
          const start = performance.now();
          const run = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            setValue(Math.round(to * eased));
            if (t < 1) requestAnimationFrame(run);
          };
          requestAnimationFrame(run);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  const shown = locale ? value.toLocaleString(locale) : value;
  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
