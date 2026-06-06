"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import { extractVariables } from "@/lib/prompts/vars";
import type { MakerAttachment, Prompt } from "@/lib/prompts/types";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; files?: string[] };

type Segment =
  | { type: "text"; value: string }
  | { type: "prompt"; value: string; complete: boolean };

// --- Speech recognition (browser dictation) minimal typings ---------------
type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// --- File → attachment helpers --------------------------------------------
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToAttachment(file: File): Promise<MakerAttachment | null> {
  const type = file.type;
  const name = file.name;
  if (type.startsWith("image/")) return { name, kind: "image", mediaType: type, data: await readAsBase64(file) };
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return { name, kind: "pdf", data: await readAsBase64(file) };
  if (/\.docx$/i.test(name) || type.includes("officedocument.wordprocessingml"))
    return { name, kind: "docx", data: await readAsBase64(file) };
  if (type.startsWith("text/") || /\.(txt|md|csv|json|html?)$/i.test(name))
    return { name, kind: "text", text: await file.text() };
  return null;
}

// Split an assistant message into prose + ```prompt blocks. The last block may
// still be streaming (no closing fence yet), in which case it shows as text
// without actions until it completes.
function parseSegments(text: string): Segment[] {
  const segs: Segment[] = [];
  const re = /```prompt[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ type: "text", value: text.slice(last, m.index) });
    segs.push({ type: "prompt", value: m[1].replace(/\n+$/, ""), complete: true });
    last = re.lastIndex;
  }
  const rest = text.slice(last);
  const open = rest.match(/```prompt[^\n]*\n([\s\S]*)$/);
  if (open) {
    const before = rest.slice(0, open.index ?? 0);
    if (before.trim()) segs.push({ type: "text", value: before });
    segs.push({ type: "prompt", value: open[1], complete: false });
  } else if (rest.trim()) {
    segs.push({ type: "text", value: rest });
  }
  return segs;
}

// The AI maker: a Claude-style chat that drafts reusable prompts from text,
// attached files (images / PDFs / Word) or dictated voice, and lets you save
// any draft to the library in one click (AI files it under a category + tags).
export function PromptMaker({ token, onSaved }: { token: string; onSaved: (p: Prompt) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<MakerAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<Recognition | null>(null);
  const baseDraftRef = useRef("");

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => recRef.current?.stop(), []);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next: MakerAttachment[] = [];
    for (const file of Array.from(list)) {
      if (file.size > 12 * 1024 * 1024) continue; // 12MB cap
      const att = await fileToAttachment(file);
      if (att) next.push(att);
    }
    if (next.length) setAttachments((a) => [...a, ...next].slice(0, 8));
  }

  function toggleMic() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      alert("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    baseDraftRef.current = draft ? draft.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setDraft(baseDraftRef.current + text);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    const atts = attachments;
    if ((!trimmed && atts.length === 0) || sendingRef.current) return;
    if (recording) recRef.current?.stop();
    sendingRef.current = true;
    setBusy(true);
    setDraft("");
    setAttachments([]);

    const userMsg: Msg = {
      role: "user",
      content: trimmed || "Read the attached file(s) and create a reusable prompt.",
      files: atts.map((a) => a.name),
    };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/admin/prompts/maker", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          attachments: atts,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`status ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: buffer };
          return next;
        });
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: "_The connection dropped. Try again._" };
        return next;
      });
    } finally {
      setBusy(false);
      sendingRef.current = false;
    }
  }

  async function save(promptBody: string, key: string) {
    setSavingKey(key);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ body: promptBody, classify: true, improve: false }),
      });
      const json = await res.json().catch(() => null);
      if (json?.ok && json.prompt) {
        onSaved(json.prompt as Prompt);
      } else {
        setSaveError(json?.error || json?.reason || `Save failed (HTTP ${res.status}).`);
      }
    } catch {
      setSaveError("Couldn't reach the server. Try again.");
    } finally {
      setSavingKey(null);
    }
  }

  const isEmpty = messages.length === 0;
  const seeds = [
    "A prompt that rewrites any text in our brand voice",
    "A prompt to turn meeting notes into action items",
    "A cold outreach email prompt with {{name}} and {{company}}",
  ];
  const canSend = !busy && (draft.trim().length > 0 || attachments.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4">
          {isEmpty ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
              <div className="space-y-2">
                <p className="text-sv-h2 font-display text-sv-text">Make a prompt with AI</p>
                <p className="mx-auto max-w-md text-sv-small text-sv-text-2">
                  Describe what you want, paste a rough prompt, attach a file, or dictate. Claude drafts a
                  clean, reusable version with {"{{variables}}"} — then save it in one click.
                </p>
              </div>
              <div className="flex w-full max-w-lg flex-col gap-2">
                {seeds.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-sv-lg border border-sv-line bg-sv-surface-2/40 px-4 py-3 text-left text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-text"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-6">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] space-y-1.5">
                      <div className="rounded-sv-lg bg-sv-surface-3 px-4 py-2.5 text-sv-small text-sv-text">
                        {m.content}
                      </div>
                      {m.files && m.files.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {m.files.map((f) => (
                            <span
                              key={f}
                              className="rounded-sv-pill border border-sv-line px-2 py-0.5 text-xs text-sv-text-3"
                            >
                              📎 {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="space-y-3">
                    {m.content === "" ? (
                      <span className="sv-label">THINKING…</span>
                    ) : (
                      parseSegments(m.content).map((seg, j) =>
                        seg.type === "text" ? (
                          <div key={j} className="text-sv-body text-sv-text-2">
                            <Markdown text={seg.value} />
                          </div>
                        ) : (
                          <div key={j} className="overflow-hidden rounded-sv-lg border border-sv-green-line bg-sv-surface-2/50">
                            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-sv-text">
                              {seg.value}
                            </pre>
                            {seg.complete && (
                              <div className="flex items-center gap-2 border-t border-sv-line bg-sv-surface-2/60 px-3 py-2">
                                <CopyButton text={seg.value} variables={extractVariables(seg.value)} />
                                <button
                                  type="button"
                                  onClick={() => void save(seg.value, `${i}-${j}`)}
                                  disabled={savingKey === `${i}-${j}`}
                                  className="rounded-sv-sm border border-sv-line px-3 py-1.5 text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-green disabled:opacity-40"
                                >
                                  {savingKey === `${i}-${j}` ? "Saving…" : "Save to library"}
                                </button>
                                {saveError && <span className="text-xs text-sv-danger">{saveError}</span>}
                              </div>
                            )}
                          </div>
                        ),
                      )
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer — Claude-style rounded box with attach / mic / send */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.docx,.txt,.md,.csv,.json,.html"
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="rounded-sv-lg border border-sv-line bg-sv-surface-2 p-2 focus-within:border-sv-green-line">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {attachments.map((a, idx) => (
                <span
                  key={`${a.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-sv-pill border border-sv-line bg-sv-surface-3 px-2.5 py-1 text-xs text-sv-text-2"
                >
                  <span>{a.kind === "image" ? "🖼" : "📎"}</span>
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((list) => list.filter((_, k) => k !== idx))}
                    className="text-sv-text-3 hover:text-sv-text"
                    aria-label={`Remove ${a.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Describe the prompt you want, attach a file, or dictate…"
            disabled={busy}
            className="max-h-48 w-full resize-none bg-transparent px-2 py-1.5 text-sv-body text-sv-text placeholder:text-sv-text-3 focus:outline-none disabled:opacity-60"
          />

          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                title="Attach files (images, PDF, Word, text)"
                className="flex h-9 w-9 items-center justify-center rounded-sv-pill border border-sv-line text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-text disabled:opacity-40"
                aria-label="Attach files"
              >
                <span className="text-lg leading-none">+</span>
              </button>
              <button
                type="button"
                onClick={toggleMic}
                disabled={busy}
                title="Dictate with your voice"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-sv-pill border transition-colors disabled:opacity-40",
                  recording
                    ? "border-sv-danger bg-sv-danger/10 text-sv-danger"
                    : "border-sv-line text-sv-text-2 hover:border-sv-green-line hover:text-sv-text",
                )}
                aria-label="Voice input"
              >
                <span className={cn("text-base leading-none", recording && "animate-pulse")}>🎤</span>
              </button>
              {recording && <span className="text-xs text-sv-danger">Listening…</span>}
            </div>

            <button
              type="button"
              onClick={() => void send(draft)}
              disabled={!canSend}
              className="flex h-9 w-9 items-center justify-center rounded-sv-pill bg-sv-green text-sv-on-accent transition-opacity hover:opacity-90 disabled:opacity-30"
              aria-label="Send"
            >
              <span className="font-mono text-base leading-none">↑</span>
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-xs text-sv-text-3">
          Claude reads images, PDFs and Word docs. Enter to send · Shift+Enter for a new line.
        </p>
      </div>
    </div>
  );
}
