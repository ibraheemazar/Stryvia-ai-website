"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// FAQ accordion (A.8): a `+` that rotates to `×`, hairline dividers, the
// answer revealing with the focus-pull ease, a green tick on the open row.
export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-t border-sv-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="border-b border-sv-line">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-6 py-6 text-start"
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                    isOpen ? "bg-sv-green" : "bg-sv-line-strong",
                  )}
                />
                <span
                  className={cn(
                    "font-display text-sv-h3 transition-colors duration-200",
                    isOpen ? "text-sv-text" : "text-sv-text-2",
                  )}
                >
                  {item.q}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-lg text-sv-text-3 transition-transform duration-300 ease-sv",
                  isOpen && "rotate-45 text-sv-green",
                )}
                aria-hidden
              >
                +
              </span>
            </button>
            <div
              className={cn(
                "grid transition-all duration-300 ease-sv",
                isOpen ? "grid-rows-[1fr] pb-6 opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl ps-6 text-sv-body text-sv-text-2">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
