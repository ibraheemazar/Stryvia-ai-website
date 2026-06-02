"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useChat } from "./ChatProvider";
import { Markdown } from "./Markdown";
import { StatusStack } from "./StatusStack";
import { HandoffForm } from "./HandoffForm";
import { Bracket } from "@/components/ui/Bracket";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// The Chat instrument (A.8). One component drives both the homepage hero
// instance and the docked panel; `variant` only changes height and chrome.
export function ChatPanel({
  variant = "hero",
  className,
}: {
  variant?: "hero" | "dock";
  className?: string;
}) {
  const t = useTranslations("chat");
  const { messages, phase, signal, error, converted, hasStarted, send, reset } = useChat();
  const [draft, setDraft] = useState("");
  const [showHandoff, setShowHandoff] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // On mobile, the hero Chat becomes a full-screen takeover once engaged (§F).
  const mobileFull = variant === "hero" && hasStarted && !minimized;

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = messages.length === 0;
  const ctaReady = signal === "ready" && !converted;

  useEffect(() => {
    if (signal === "ready") track("chat_cta_shown");
    if (converted) setShowHandoff(false);
  }, [signal, converted]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, phase, showHandoff]);

  // Auto-grow the textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [draft]);

  // Move focus into the input when the panel becomes interactive, so the user
  // can type immediately (especially the mobile takeover) — but never steal
  // focus from the handoff form once it's showing.
  useEffect(() => {
    if (phase === "idle" && !showHandoff && !converted && (variant === "dock" || hasStarted)) {
      taRef.current?.focus();
    }
  }, [phase, hasStarted, variant, showHandoff, converted]);

  // Lock body scroll behind the mobile full-screen takeover so the page can't
  // scroll underneath the chat.
  useEffect(() => {
    if (!mobileFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileFull]);

  function submit() {
    if (!draft.trim() || phase !== "idle") return;
    const text = draft;
    setDraft("");
    setShowHandoff(false);
    void send(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const chips = t.raw("chips") as string[];

  return (
    <div
      className={cn(
        "sv-scanlines relative flex flex-col overflow-hidden rounded-sv-lg border border-sv-line-strong bg-sv-surface-1",
        variant === "hero" ? "min-h-[30rem]" : "h-full",
        mobileFull &&
          "max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:min-h-0 max-sm:rounded-none",
        className,
      )}
    >
      <Bracket live focusIn />

      {/* Header — mono label row with the live state */}
      <div className="flex items-center justify-between border-b border-sv-line px-4 py-3">
        <span className="sv-label">{t("title")}</span>
        <span className="flex items-center gap-2">
          <span className="sv-live-dot" />
          <span className="sv-label sv-label--live">{t("live")}</span>
          {mobileFull && (
            <button
              type="button"
              onClick={() => setMinimized(true)}
              aria-label={t("minimize")}
              className="ms-2 flex h-7 w-7 items-center justify-center rounded-sv-sm text-sv-text-2 sm:hidden"
            >
              <span className="text-lg leading-none">⌄</span>
            </button>
          )}
        </span>
      </div>

      {/* Conversation surface */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label={t("ariaLog")}
      >
        {isEmpty && phase === "idle" ? (
          <div className="flex flex-col gap-5 py-3">
            <p className="font-display text-sv-h3 text-sv-text">{t("emptyPrompt")}</p>
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void send(chip)}
                  className="group relative rounded-sv-pill border border-sv-line px-3.5 py-1.5 text-sv-small text-sv-text-2 transition-colors duration-200 hover:border-sv-green-line hover:text-sv-green"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-sv-md bg-sv-surface-2 px-3.5 py-2.5 text-sv-body text-sv-text">
                      {m.content}
                    </div>
                  </div>
                );
              }
              // assistant
              const focusing = isLast && phase === "focusing";
              return (
                <div key={i} className="relative">
                  {focusing ? (
                    <StatusStack />
                  ) : (
                    <div
                      className={cn(
                        "relative rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-4",
                        isLast && phase === "streaming" && "sv-stream-caret",
                      )}
                    >
                      <Markdown text={m.content} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Confidence threshold — honest, no green celebration, with a
                plain message and a route to a human (A.8) */}
            {signal === "human" && !showHandoff && !converted && (
              <div className="rounded-sv-md border border-sv-warn/40 bg-sv-surface-2 p-4 sv-reveal">
                <p className="sv-label mb-2 text-sv-warn">{t("threshold")}</p>
                <p className="mb-4 text-sv-small text-sv-text-2">{t("thresholdBody")}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowHandoff(true);
                    track("lead_started");
                  }}
                >
                  {t("thresholdAction")}
                </Button>
              </div>
            )}

            {/* Inspect the reasoning — a calm list of the steps taken (A.8),
                never a raw transcript */}
            {ctaReady && !showHandoff && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setInspect((v) => !v)}
                  className="font-mono text-sv-label-sm uppercase tracking-[0.14em] text-sv-text-3 transition-colors hover:text-sv-text"
                >
                  {inspect ? `− ${t("scope.inspectClose")}` : `+ ${t("scope.inspect")}`}
                </button>
                {inspect && (
                  <div className="mt-3 space-y-1.5 border-s border-sv-line ps-4 sv-reveal">
                    {[
                      t("status.understanding"),
                      t("status.mapping"),
                      t("status.shaping"),
                    ].map((line) => (
                      <p key={line} className="sv-label text-sv-text-3">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA after a delivered scope, or the handoff form */}
            {ctaReady && !showHandoff && (
              <div className="flex flex-col gap-2 pt-1 sv-reveal">
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowHandoff(true);
                    track("lead_started");
                  }}
                >
                  {t("cta")}
                </Button>
                <button
                  type="button"
                  onClick={() => taRef.current?.focus()}
                  className="self-start text-sv-small text-sv-text-3 transition-colors hover:text-sv-text"
                >
                  {t("askElse")}
                </button>
              </div>
            )}
            {showHandoff && !converted && <HandoffForm />}
            {converted && <HandoffForm />}

            {error && <p className="text-sv-small text-sv-danger">{t("error")}</p>}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-sv-line p-3">
        <div className="flex items-end gap-2 rounded-sv-md border border-sv-line bg-sv-surface-3 px-3 py-2 transition-colors duration-200 focus-within:border-sv-green-line">
          <textarea
            ref={taRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("placeholder")}
            disabled={phase !== "idle"}
            className="max-h-40 flex-1 resize-none bg-transparent text-sv-body text-sv-text placeholder:text-sv-text-3 focus:outline-none disabled:opacity-60"
            aria-label={t("placeholder")}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || phase !== "idle"}
            aria-label={t("send")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sv-sm bg-sv-green text-sv-on-accent transition-opacity duration-200 disabled:opacity-30"
          >
            <span className="font-mono text-lg leading-none rtl:-scale-x-100">→</span>
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="sv-label-sm sv-label">{t("newLine")}</span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-sv-label-sm text-sv-text-3 transition-colors hover:text-sv-text"
            >
              {t("askElse")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
