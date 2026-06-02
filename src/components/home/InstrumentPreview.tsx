"use client";

import { useEffect, useRef, useState } from "react";
import { Bracket } from "@/components/ui/Bracket";

// The signature visual: a bespoke, on-brand preview of "the instrument" — the
// director's view of the working relationship. The brief comes in, the
// intelligence orchestrates and drafts, it surfaces the choices that matter,
// you decide, and the work assembles. A calm, stepped walkthrough — clearly a
// preview, never a claim of a live, clickable product (Spec §6).
//
// All content is passed in (translated by the server page), so it stays
// trilingual. Dark, one green signal, bracket-framed; reduced-motion shows the
// composed final state; layout is logical-prop based so it mirrors in RTL.

export type InstrumentContent = {
  chrome: string;
  project: string;
  directing: string;
  brief: { label: string; problem: string; decisions: string[] };
  work: { label: string; building: string; pieces: string[] };
  choices: {
    label: string;
    awaiting: string;
    items: { q: string; a: string }[];
    accept: string;
    redirect: string;
  };
  phases: string[];
  note: string;
};

const PHASE_MS = 2600;

function useWalkthrough(
  phaseCount: number,
  ref: React.RefObject<HTMLElement | null>,
): number {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(phaseCount - 1); // show the fully composed state
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => setStep((s) => (s + 1) % phaseCount), PHASE_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    // Only advance while the preview is actually on screen — no wasted CPU or
    // battery running the walkthrough behind the fold.
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      start();
      return stop;
    }
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
  }, [phaseCount, ref]);

  return step;
}

export function InstrumentPreview({
  content,
  className,
}: {
  content: InstrumentContent;
  className?: string;
}) {
  const { chrome, project, directing, brief, work, choices, phases, note } = content;
  const rootRef = useRef<HTMLElement | null>(null);
  const step = useWalkthrough(phases.length, rootRef);

  // Derived visual state from the active phase.
  const builtCount = step <= 0 ? 0 : step === 1 ? 2 : step === 2 ? 3 : work.pieces.length;
  const showChoices = step >= 2;
  const approved = step >= 3;

  return (
    <figure ref={rootRef} className={className}>
      <div className="relative overflow-hidden rounded-sv-lg border border-sv-line bg-sv-surface-1/70 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm sv-glow">
        <Bracket live size={18} inset={8} focusIn />

        {/* ── Chrome bar ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-sv-line px-4 py-3 sm:px-5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sv-green sv-live-dot" aria-hidden />
          <span className="sv-label-sm sv-label truncate">{chrome}</span>
          <span className="mx-2 hidden h-3 w-px bg-sv-line-strong sm:block" aria-hidden />
          <span className="hidden truncate text-sv-small text-sv-text-2 sm:block">{project}</span>
          <span className="sv-label-sm sv-label sv-label--live ms-auto shrink-0">{directing}</span>
        </div>

        {/* ── Body: brief · work · choices ─────────────────────────────── */}
        <div className="grid gap-px bg-sv-line md:grid-cols-[5fr_6fr_5fr]">
          {/* The brief + director decisions */}
          <div className="bg-sv-surface-1/80 p-4 sm:p-5">
            <p className="sv-label-sm sv-label">{brief.label}</p>
            <p className="mt-3 text-sv-small leading-relaxed text-sv-text">{brief.problem}</p>
            <ul className="mt-4 space-y-2">
              {brief.decisions.map((d, i) => (
                <li
                  key={d}
                  className="flex items-start gap-2 text-sv-small text-sv-text-2 transition-all duration-500"
                  style={{ opacity: step >= i ? 1 : 0.25, transform: step >= i ? "none" : "translateY(3px)" }}
                >
                  <CheckDot on={step >= i} />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The work assembling */}
          <div className="relative bg-sv-base/60 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="sv-label-sm sv-label">{work.label}</p>
              <span className="sv-label-sm sv-label sv-label--live">{`${builtCount}/${work.pieces.length}`}</span>
            </div>
            <p className="mt-3 text-sv-small text-sv-text-2">{work.building}</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {work.pieces.map((p, i) => {
                const built = i < builtCount;
                return (
                  <div
                    key={p}
                    className="relative flex h-[58px] items-center justify-center rounded-sv-sm border px-2 text-center text-[0.7rem] leading-tight transition-all duration-700"
                    style={{
                      borderColor: built ? "var(--color-sv-green-line)" : "var(--color-sv-line)",
                      background: built ? "var(--color-sv-green-soft)" : "var(--color-sv-surface-2)",
                      color: built ? "var(--color-sv-text)" : "var(--color-sv-text-3)",
                      opacity: built ? 1 : 0.6,
                    }}
                  >
                    {built && (
                      <span
                        className="absolute inset-x-0 top-0 h-px"
                        style={{ background: "var(--color-sv-green)" }}
                        aria-hidden
                      />
                    )}
                    {p}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Choices surfaced for the director */}
          <div className="bg-sv-surface-1/80 p-4 sm:p-5">
            <p className="sv-label-sm sv-label">{choices.label}</p>
            <div className="mt-3 space-y-2.5">
              {choices.items.map((c, i) => {
                const visible = showChoices;
                const isLead = i === 0;
                return (
                  <div
                    key={c.q}
                    className="rounded-sv-sm border p-2.5 transition-all duration-500"
                    style={{
                      opacity: visible ? 1 : 0.2,
                      transform: visible ? "none" : "translateY(4px)",
                      borderColor:
                        visible && isLead && !approved
                          ? "var(--color-sv-green-line)"
                          : "var(--color-sv-line)",
                      background:
                        visible && isLead && !approved ? "var(--color-sv-green-soft)" : "transparent",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sv-small text-sv-text">{c.q}</span>
                      {isLead &&
                        visible &&
                        (approved ? (
                          <span className="sv-label-sm sv-label sv-label--live flex items-center gap-1">
                            <CheckDot on />
                            {choices.accept}
                          </span>
                        ) : (
                          <span className="sv-label-sm sv-label sv-label--live animate-pulse">
                            {choices.awaiting}
                          </span>
                        ))}
                    </div>
                    <p className="mt-1 text-[0.7rem] text-sv-text-2">{c.a}</p>
                    {isLead && visible && !approved && (
                      <div className="mt-2 flex gap-1.5">
                        <span className="rounded-sv-sm bg-sv-green px-2 py-0.5 text-[0.65rem] font-medium text-sv-on-accent">
                          {choices.accept}
                        </span>
                        <span className="rounded-sv-sm border border-sv-line px-2 py-0.5 text-[0.65rem] text-sv-text-2">
                          {choices.redirect}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Status rail: the phases, active one lit ──────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-sv-line px-4 py-3 sm:px-5">
          {phases.map((p, i) => (
            <span
              key={p}
              className="sv-label-sm sv-label flex items-center gap-1.5 transition-colors duration-300"
              style={{ color: i === step ? "var(--color-sv-green)" : undefined }}
            >
              <span
                className="h-1 w-1 rounded-full transition-colors duration-300"
                style={{ background: i <= step ? "var(--color-sv-green)" : "var(--color-sv-line-strong)" }}
                aria-hidden
              />
              {p}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 text-center text-sv-small text-sv-text-3">{note}</figcaption>
    </figure>
  );
}

function CheckDot({ on }: { on: boolean }) {
  return (
    <span
      className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-all duration-300"
      style={{
        borderColor: on ? "var(--color-sv-green)" : "var(--color-sv-line-strong)",
        background: on ? "var(--color-sv-green)" : "transparent",
      }}
      aria-hidden
    >
      {on && (
        <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none">
          <path d="M2 5.2 4 7.2 8 2.8" stroke="var(--color-sv-on-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
