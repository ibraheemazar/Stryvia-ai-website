"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCENTS,
  ACCENT_COOKIE,
  MODE_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type AccentId,
  type ThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

// Admin colour control. Mirrors the public site's ThemePicker — same theme.ts
// palette, same cookies, same [data-theme]/[data-accent] attributes — but with
// plain English labels and no next-intl dependency, since the admin is a
// locale-agnostic internal tool without an intl provider. Because the cookies
// are shared, the choice applies to the public site too.

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
}

export function AdminThemePicker({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [accent, setAccent] = useState<AccentId>("acid");
  const ref = useRef<HTMLDivElement>(null);

  // Read the current state from <html> (the layout script already set it), so
  // the control matches what's rendered with no flash or hydration mismatch.
  useEffect(() => {
    const el = document.documentElement;
    setMode(el.dataset.theme === "light" ? "light" : "dark");
    setAccent((el.dataset.accent as AccentId) || "acid");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Element)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(nextMode: ThemeMode, nextAccent: AccentId) {
    const el = document.documentElement;
    el.dataset.theme = nextMode;
    el.dataset.accent = nextAccent;
    writeCookie(MODE_COOKIE, nextMode);
    writeCookie(ACCENT_COOKIE, nextAccent);
    window.dispatchEvent(new CustomEvent("sv:themechange"));
  }

  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-sv-pill border border-sv-line px-3 text-sv-text-2 transition-colors hover:border-sv-line-strong hover:text-sv-text"
      >
        <span
          className="h-3 w-3 rounded-full ring-1 ring-sv-line-strong"
          style={{ backgroundColor: current.swatch }}
          aria-hidden
        />
        <span className="sv-label sv-label-sm hidden sm:inline">Theme</span>
      </button>

      {open && (
        <div
          className="absolute end-0 top-11 z-50 w-56 rounded-sv-md border border-sv-line bg-sv-surface-1/95 p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md"
          role="dialog"
          aria-label="Theme"
        >
          <p className="sv-label sv-label-sm mb-2">MODE</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["dark", "light"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  apply(m, accent);
                }}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-sv-sm border px-2 py-2 text-sv-small capitalize transition-colors",
                  mode === m
                    ? "border-sv-green-line text-sv-green"
                    : "border-sv-line text-sv-text-2 hover:text-sv-text",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <p className="sv-label sv-label-sm mb-2 mt-4">ACCENT</p>
          <div className="flex items-center gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAccent(a.id);
                  apply(mode, a.id);
                }}
                aria-label={a.id}
                aria-pressed={accent === a.id}
                title={a.id}
                className={cn(
                  "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-sv-surface-1 transition-transform hover:scale-110",
                  accent === a.id ? "ring-sv-text" : "ring-transparent",
                )}
                style={{ backgroundColor: a.swatch }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
