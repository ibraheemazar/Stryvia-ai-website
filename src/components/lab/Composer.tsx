"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { VoiceButton } from "./VoiceButton";
import { textDir } from "./lab-client";

// Text + voice input (brief §2 UX). Enter sends, Shift+Enter breaks a line.
// A voice transcript lands here as editable text before it is sent.
export function Composer({
  sessionId,
  language,
  voiceProvider,
  disabled,
  options,
  onSend,
  maxChars,
}: {
  sessionId: string;
  language: "en" | "ar";
  voiceProvider: "browser" | "server";
  disabled: boolean;
  options?: string[];
  onSend: (text: string, mode: "text" | "voice", raw?: string) => void;
  maxChars: number;
}) {
  const t = useTranslations("lab.session");
  const [draft, setDraft] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [draft]);

  useEffect(() => {
    if (!disabled) taRef.current?.focus();
  }, [disabled]);

  function submit(text = draft) {
    const v = text.trim();
    if (!v || disabled) return;
    onSend(v.slice(0, maxChars), raw ? "voice" : "text", raw ?? undefined);
    setDraft("");
    setRaw(null);
  }

  return (
    <div className="grid gap-3">
      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => submit(o)}
              className="min-h-10 rounded-sv-pill border border-sv-line-strong px-4 text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-text"
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {raw && <p className="text-sv-label text-sv-text-3">{t("voiceReview")}</p>}
      <div className={cn("flex items-end gap-2 rounded-sv-md border bg-sv-surface-2 p-2 transition-colors", disabled ? "border-sv-line" : "border-sv-line-strong focus-within:border-sv-green-line")}>
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          dir={draft ? textDir(draft) : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          disabled={disabled}
          maxLength={maxChars}
          className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sv-body text-sv-text placeholder:text-sv-text-3 focus:outline-none"
        />
        <VoiceButton
          sessionId={sessionId}
          language={language}
          provider={voiceProvider}
          disabled={disabled}
          onTranscript={(text, r) => {
            setDraft((d) => (d ? `${d} ${text}` : text));
            setRaw(r);
          }}
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={disabled || !draft.trim()}
          aria-label={t("send")}
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-sv-sm bg-sv-green px-3 text-sv-on-accent transition-all hover:-translate-y-px active:translate-y-0 disabled:bg-sv-surface-3 disabled:text-sv-text-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rtl:-scale-x-100" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
