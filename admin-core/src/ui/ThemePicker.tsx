"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminAccent } from "../config";
import { cn } from "./cn";

// Theme control: dark/light mode + accent. Mode toggles the `dark` class on
// <html>; accent sets the --admin-accent CSS variable that the rest of the
// chassis reads. Both persist in localStorage. No design-system dependency.

const MODE_KEY = "admin-core:mode";
const ACCENT_KEY = "admin-core:accent";

export function ThemePicker({
  accents,
  defaultMode = "dark",
  defaultAccent,
}: {
  accents: AdminAccent[];
  defaultMode?: "dark" | "light";
  defaultAccent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"dark" | "light">(defaultMode);
  const [accentId, setAccentId] = useState<string>(defaultAccent || accents[0]?.id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = (localStorage.getItem(MODE_KEY) as "dark" | "light") || defaultMode;
    const a = localStorage.getItem(ACCENT_KEY) || defaultAccent || accents[0]?.id;
    apply(m, a);
    setMode(m);
    setAccentId(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function apply(nextMode: "dark" | "light", nextAccentId: string) {
    const el = document.documentElement;
    el.classList.toggle("dark", nextMode === "dark");
    const swatch = accents.find((a) => a.id === nextAccentId)?.swatch;
    if (swatch) el.style.setProperty("--admin-accent", swatch);
    localStorage.setItem(MODE_KEY, nextMode);
    localStorage.setItem(ACCENT_KEY, nextAccentId);
  }

  const current = accents.find((a) => a.id === accentId) ?? accents[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-zinc-700 px-3 text-zinc-400 hover:text-zinc-100"
      >
        <span className="h-3 w-3 rounded-full ring-1 ring-zinc-600" style={{ backgroundColor: current?.swatch }} />
        <span className="hidden text-xs uppercase tracking-wider sm:inline">Theme</span>
      </button>

      {open && (
        <div className="absolute end-0 top-11 z-50 w-56 rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
          <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Mode</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["dark", "light"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  apply(m, accentId);
                }}
                className={cn(
                  "rounded-md border px-2 py-2 text-sm capitalize",
                  mode === m ? "border-zinc-400 text-zinc-100" : "border-zinc-700 text-zinc-400 hover:text-zinc-100",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 text-xs uppercase tracking-wider text-zinc-500">Accent</p>
          <div className="flex items-center gap-2.5">
            {accents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAccentId(a.id);
                  apply(mode, a.id);
                }}
                aria-label={a.id}
                title={a.id}
                className={cn(
                  "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-zinc-900 transition-transform hover:scale-110",
                  accentId === a.id ? "ring-zinc-100" : "ring-transparent",
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
