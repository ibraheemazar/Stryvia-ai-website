"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ACCENTS,
  ACCENT_COOKIE,
  MODE_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type AccentId,
  type ThemeMode,
} from "@/lib/theme";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
}

// Remembers that the visitor has discovered the customizer, so the first-visit
// nudge + attention pulse show exactly once and never nag on return.
const SEEN_KEY = "sv-theme-customizer-seen";

// Sliders glyph — signals "adjust / customize", which a bare swatch never did.
function SlidersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// Reads the current state straight off <html> so it always matches what the
// server rendered (no hydration mismatch, no flash).
function readMode(): ThemeMode {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function readAccent(): AccentId {
  return (document.documentElement.dataset.accent as AccentId) || "acid";
}

export function ThemePicker({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [accent, setAccent] = useState<AccentId>("acid");
  // Defaults keep the server render quiet (no pulse/nudge) until we confirm
  // this is a first visit — avoids any hydration flash.
  const [hasSeen, setHasSeen] = useState(true);
  const [nudgeReady, setNudgeReady] = useState(false);
  // Open the panel upward when the trigger is low on the screen (e.g. the
  // mobile menu, where the picker sits near the bottom) so it never opens
  // off-screen and out of reach.
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync from the DOM after mount (server already set the attributes).
  useEffect(() => {
    setMode(readMode());
    setAccent(readAccent());
  }, []);

  // First visit: surface the attention pulse immediately and the coachmark a
  // beat later so it doesn't fight the page load.
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    setHasSeen(false);
    const id = window.setTimeout(() => setNudgeReady(true), 1100);
    return () => window.clearTimeout(id);
  }, []);

  function markSeen() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setHasSeen(true);
    setNudgeReady(false);
  }

  // Decide direction whenever the panel opens, from the live trigger position.
  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 280);
  }, [open]);

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
    // Let canvas-based visuals (HeroCanvas) recolor live.
    window.dispatchEvent(new CustomEvent("sv:themechange"));
  }

  function chooseMode(next: ThemeMode) {
    setMode(next);
    apply(next, accent);
    track("theme_changed", { mode: next, accent });
  }
  function chooseAccent(next: AccentId) {
    setAccent(next);
    apply(mode, next);
    track("theme_changed", { mode, accent: next });
  }

  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!hasSeen) markSeen();
        }}
        aria-label={t("label")}
        aria-expanded={open}
        className="relative flex h-9 items-center gap-2 rounded-sv-pill border border-sv-line px-3 text-sv-text-2 transition-colors duration-200 hover:border-sv-line-strong hover:text-sv-text"
      >
        {/* attention pulse — first visit only, until discovered */}
        {!hasSeen && (
          <span
            className="pointer-events-none absolute inset-0 rounded-sv-pill ring-1 ring-sv-green-line animate-ping"
            aria-hidden
          />
        )}
        <SlidersIcon />
        <span
          className="h-3 w-3 rounded-full ring-1 ring-sv-line-strong"
          style={{ backgroundColor: current.swatch }}
          aria-hidden
        />
        <span className="sv-label sv-label-sm hidden sm:inline">{t("labelShort")}</span>
      </button>

      {/* First-visit coachmark — tells people the capability exists, once. */}
      {!hasSeen && nudgeReady && !open && (
        <div
          role="status"
          className={cn(
            "absolute end-0 z-50 w-60 rounded-sv-md border border-sv-green-line bg-sv-surface-1/95 p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md sv-reveal is-visible",
            dropUp ? "bottom-full mb-2" : "top-12",
          )}
        >
          <span
            className="absolute -top-1 end-6 h-2.5 w-2.5 rotate-45 border-s border-t border-sv-green-line bg-sv-surface-1"
            aria-hidden
          />
          <div className="flex items-start justify-between gap-3">
            <p className="sv-label sv-label--live">{t("nudgeTitle")}</p>
            <button
              type="button"
              onClick={markSeen}
              aria-label={t("nudgeDismiss")}
              className="-mt-1 text-sv-text-3 transition-colors hover:text-sv-text"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-sv-small text-sv-text-2">{t("nudgeBody")}</p>
          <button
            type="button"
            onClick={() => {
              markSeen();
              setOpen(true);
            }}
            className="mt-3 inline-flex items-center gap-1 font-mono text-sv-label uppercase tracking-[0.14em] text-sv-green transition-opacity hover:opacity-80"
          >
            {t("nudgeCta")} →
          </button>
        </div>
      )}

      {open && (
        <div
          className={cn(
            "absolute end-0 z-50 w-56 rounded-sv-md border border-sv-line bg-sv-surface-1/95 p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md",
            dropUp ? "bottom-full mb-2" : "top-11",
          )}
          role="dialog"
          aria-label={t("label")}
        >
          <p className="sv-label sv-label-sm mb-2">{t("mode")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["dark", "light"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => chooseMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-sv-sm border px-2 py-2 text-sv-small transition-colors duration-200",
                  mode === m
                    ? "border-sv-green-line text-sv-green"
                    : "border-sv-line text-sv-text-2 hover:text-sv-text",
                )}
              >
                {t(m)}
              </button>
            ))}
          </div>

          <p className="sv-label sv-label-sm mb-2 mt-4">{t("accent")}</p>
          <div className="flex items-center gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => chooseAccent(a.id)}
                aria-label={t(a.labelKey)}
                aria-pressed={accent === a.id}
                title={t(a.labelKey)}
                className={cn(
                  "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-sv-surface-1 transition-transform duration-200 hover:scale-110",
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
