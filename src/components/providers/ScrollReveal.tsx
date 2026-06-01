"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Plays the focus-pull as elements enter the viewport (A.7) instead of all at
// once on load. Anything already on screen (the hero) reveals immediately;
// below-fold content reveals as it's scrolled to. A MutationObserver catches
// elements added after mount — the Chat's status lines, CTA, threshold panel —
// and registers them too (they're in view, so they reveal immediately).
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const SEL = ".sv-reveal:not(.is-visible), .sv-rise-strong:not(.is-visible)";

    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll<HTMLElement>(SEL).forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );

    const register = (root: ParentNode) =>
      root.querySelectorAll<HTMLElement>(SEL).forEach((el) => io.observe(el));

    register(document);

    // Catch dynamically-rendered reveal elements (chat states, etc.).
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as HTMLElement;
          if (
            (el.classList?.contains("sv-reveal") || el.classList?.contains("sv-rise-strong")) &&
            !el.classList.contains("is-visible")
          ) {
            io.observe(el);
          }
          register(el);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
