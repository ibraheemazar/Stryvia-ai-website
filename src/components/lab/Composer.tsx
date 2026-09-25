"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ATTACHMENT_LIMITS, checkAttachment, humanSize } from "@/lib/lab/attachment-policy";
import { VoiceButton } from "./VoiceButton";
import { labFetch, textDir } from "./lab-client";

// Text + voice + files (brief §2 UX). Enter sends, Shift+Enter breaks a line.
// A voice transcript lands here as editable text before it is sent. Files go
// straight to Stryvia's private storage (signed upload) and are sent with the
// next message; the owner keeps every one of them.

export type ComposerFile = { key: string; name: string; size: number; state: "uploading" | "stored" | "failed"; id?: string; error?: string };

async function uploadFile(sessionId: string, file: File): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const reserve = await labFetch<{ ok: boolean; attachment?: { id: string }; uploadUrl?: string; error?: string }>(`/api/lab/session/${sessionId}/attachments`, {
    method: "POST",
    body: JSON.stringify({ name: file.name, mime: file.type || "application/octet-stream", size: file.size }),
    timeoutMs: 20_000,
  });
  if (!reserve.data.ok || !reserve.data.attachment || !reserve.data.uploadUrl) return { ok: false, error: reserve.data.error ?? "upload" };
  const put = await fetch(reserve.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file,
  }).catch(() => null);
  if (!put || !put.ok) return { ok: false, error: "upload" };
  const confirm = await labFetch<{ ok: boolean; error?: string }>(`/api/lab/session/${sessionId}/attachments/${reserve.data.attachment.id}`, { method: "POST", body: "{}", timeoutMs: 20_000 });
  return confirm.data.ok ? { ok: true, id: reserve.data.attachment.id } : { ok: false, error: confirm.data.error ?? "upload" };
}
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
  onSend: (text: string, mode: "text" | "voice", raw?: string, files?: Array<{ id: string; name: string; size: number }>) => void;
  maxChars: number;
}) {
  const t = useTranslations("lab.session");
  const [draft, setDraft] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [voiceIds, setVoiceIds] = useState<string[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = files.some((f) => f.state === "uploading");
  const stored = files.filter((f) => f.state === "stored" && f.id);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, ATTACHMENT_LIMITS.maxFilesPerMessage - files.length);
    // Show every chosen file at once, then upload them in parallel.
    const entries = picked.map((file) => {
      const check = checkAttachment({ name: file.name, mime: file.type, size: file.size });
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
      return { file, key, chip: check.ok ? ({ key, name: file.name, size: file.size, state: "uploading" } as ComposerFile) : ({ key, name: file.name, size: file.size, state: "failed", error: check.reason } as ComposerFile) };
    });
    setFiles((fs) => [...fs, ...entries.map((e) => e.chip)]);
    if (fileRef.current) fileRef.current.value = "";
    await Promise.all(
      entries
        .filter((e) => e.chip.state === "uploading")
        .map(async ({ file, key }) => {
          const res = await uploadFile(sessionId, file).catch(() => ({ ok: false as const, error: "upload" }));
          setFiles((fs) => fs.map((f) => (f.key === key ? (res.ok ? { ...f, state: "stored", id: res.id } : { ...f, state: "failed", error: res.error }) : f)));
        }),
    );
  }

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
    if ((!v && stored.length === 0) || disabled || uploading) return;
    const sent = [...stored.map((f) => ({ id: f.id as string, name: f.name, size: f.size })), ...voiceIds.map((id) => ({ id, name: "voice note", size: 0 }))];
    onSend(v.slice(0, maxChars), raw ? "voice" : "text", raw ?? undefined, sent);
    setDraft("");
    setRaw(null);
    setFiles([]);
    setVoiceIds([]);
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
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-live="polite" data-testid="composer-files">
          {files.map((f) => (
            <li key={f.key} className={cn("flex min-h-9 items-center gap-2 rounded-sv-pill border px-3 text-sv-small", f.state === "failed" ? "border-sv-danger text-sv-danger" : "border-sv-line-strong text-sv-text-2")} data-state={f.state}>
              <span dir="auto" className="max-w-48 truncate">{f.name}</span>
              <span className="text-sv-text-3">{humanSize(f.size)}</span>
              <span className="text-sv-label">{f.state === "uploading" ? t("attachUploading") : f.state === "stored" ? t("attachStored") : t(`attachError.${f.error === "blocked_type" || f.error === "too_large" || f.error === "limit_files" || f.error === "limit_bytes" ? f.error : "upload"}`)}</span>
              <button type="button" onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))} aria-label={t("attachRemove", { name: f.name })} className="min-h-7 min-w-7 text-sv-text-3 hover:text-sv-text">×</button>
            </li>
          ))}
        </ul>
      )}
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
        <input
          ref={fileRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void addFiles(e.target.files)}
          data-testid="composer-file-input"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || files.length >= ATTACHMENT_LIMITS.maxFilesPerMessage}
          aria-label={t("attach")}
          title={t("attach")}
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-sv-sm text-sv-text-2 transition-colors hover:text-sv-text disabled:text-sv-text-3"
          data-testid="composer-attach"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l7.5-7.5" />
          </svg>
        </button>
        <VoiceButton
          sessionId={sessionId}
          language={language}
          provider={voiceProvider}
          disabled={disabled}
          onTranscript={(text, r, attachmentId) => {
            setDraft((d) => (d ? `${d} ${text}` : text));
            setRaw(r);
            if (attachmentId) setVoiceIds((ids) => [...ids, attachmentId]);
          }}
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={disabled || uploading || (!draft.trim() && stored.length === 0)}
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
