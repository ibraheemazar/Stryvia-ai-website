"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import { extractVariables } from "@/lib/prompts/vars";
import type { Prompt } from "@/lib/prompts/types";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

type Segment =
  | { type: "text"; value: string }
  | { type: "prompt"; value: string; complete: boolean };

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

// The AI maker: a chat that drafts reusable prompts and lets you save any draft
// to the library in one click (AI files it under a category + tags on save).
export function PromptMaker({
  token,
  onSaved,
}: {
  token: string;
  onSaved: (p: Prompt) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    setDraft("");

    const history = [...messages, { role: "user", content: trimmed } as Msg];
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/admin/prompts/maker", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
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
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // The maker already produced the final wording — AI only files it.
        body: JSON.stringify({ body: promptBody, classify: true, improve: false }),
      });
      const json = await res.json();
      if (json?.ok && json.prompt) onSaved(json.prompt as Prompt);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {isEmpty ? (
          <div className="mx-auto max-w-xl space-y-5 py-10 text-center">
            <p className="text-sv-h3 text-sv-text">Make a prompt with AI</p>
            <p className="text-sv-small text-sv-text-2">
              Describe what you want, or paste a rough prompt. Claude drafts a clean, reusable version
              with {"{{variables}}"} for the parts that change — then save it to your library in one click.
            </p>
            <div className="flex flex-col items-stretch gap-2">
              {seeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-sv-md border border-sv-line px-3 py-2 text-left text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-green"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-sv-md bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="space-y-3">
                {m.content === "" ? (
                  <span className="sv-label">THINKING…</span>
                ) : (
                  parseSegments(m.content).map((seg, j) =>
                    seg.type === "text" ? (
                      <div key={j} className="text-sv-small text-sv-text-2">
                        <Markdown text={seg.value} />
                      </div>
                    ) : (
                      <div
                        key={j}
                        className="rounded-sv-md border border-sv-green-line bg-sv-surface-2/50 p-3"
                      >
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-sv-text">
                          {seg.value}
                        </pre>
                        {seg.complete && (
                          <div className="mt-3 flex items-center gap-2 border-t border-sv-line pt-3">
                            <CopyButton text={seg.value} variables={extractVariables(seg.value)} />
                            <button
                              type="button"
                              onClick={() => void save(seg.value, `${i}-${j}`)}
                              disabled={savingKey === `${i}-${j}`}
                              className="rounded-sv-sm border border-sv-line px-3 py-1.5 text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-green disabled:opacity-40"
                            >
                              {savingKey === `${i}-${j}` ? "Saving…" : "Save to library"}
                            </button>
                          </div>
                        )}
                      </div>
                    ),
                  )
                )}
              </div>
            ),
          )
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="m-4 mt-0 flex items-end gap-2 rounded-sv-md border border-sv-line bg-sv-surface-3 px-3 py-2 focus-within:border-sv-green-line"
      >
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
          placeholder="Describe the prompt you want, or paste one to refine…"
          disabled={busy}
          className={cn(
            "max-h-32 flex-1 resize-none bg-transparent text-sv-small text-sv-text placeholder:text-sv-text-3 focus:outline-none disabled:opacity-60",
          )}
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sv-sm bg-sv-green text-sv-on-accent transition-opacity disabled:opacity-30"
          aria-label="Send"
        >
          <span className="font-mono text-base leading-none">→</span>
        </button>
      </form>
    </div>
  );
}
