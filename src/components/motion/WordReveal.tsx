"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/scroll";
import { cn } from "@/lib/utils";

// Assembles a headline word-by-word as it enters view: each word rises and
// fades in on a small stagger. Renders the full text as real, selectable,
// SEO-visible content (no layout shift); we only animate per-word wrappers.
// Reduced-motion shows it instantly.
export function WordReveal({
  text,
  as,
  className,
  stagger = 55,
  start = 0,
  gradient = false,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  className?: string;
  stagger?: number;
  start?: number;
  gradient?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const Tag = (as ?? "span") as React.ElementType;
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>("[data-word]"));
    if (reducedMotion()) {
      spans.forEach((s) => s.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          spans.forEach((s, i) => {
            s.style.transitionDelay = `${start + i * stagger}ms`;
            requestAnimationFrame(() => s.classList.add("is-in"));
          });
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stagger, start, text]);

  return (
    <Tag
      ref={ref}
      className={cn("sv-words", gradient && "sv-words--grad", className)}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span key={i} className="sv-word" aria-hidden="true">
          <span data-word className="sv-word-inner">
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}
