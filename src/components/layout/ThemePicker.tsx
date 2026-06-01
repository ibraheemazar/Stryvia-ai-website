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
  const ref = useRef<HTMLDivElement>(null);

  // Sync from the DOM after mount (server already set the attributes).
  useEffect(() => {
    setMode(readMode());
    setAccent(readAccent());
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
        onClick={() => setOpen((v) => !v)}
        aria-label={t("label")}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-sv-sm text-sv-text-2 transition-colors duration-200 hover:text-sv-text"
      >
        <span
          className="h-3.5 w-3.5 rounded-full ring-1 ring-sv-line-strong"
          style={{ backgroundColor: current.swatch }}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="absolute end-0 top-11 z-50 w-56 rounded-sv-md border border-sv-line bg-sv-surface-1/95 p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md"
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
