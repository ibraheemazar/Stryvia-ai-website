"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

// Streamed chat against an admin AI endpoint (insights/ask or copilot). Plain
// text stream; the assistant bubble fills in as tokens arrive. Auth via the
// admin access token.
export function AdminChat({
  token,
  endpoint,
  range,
  placeholder,
  emptyHint,
  seeds,
  className,
}: {
  token: string;
  endpoint: string;
  range?: string;
  placeholder: string;
  emptyHint?: string;
  seeds?: { label: string; prompt: string }[];
  className?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
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
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, range }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`status ${res.status}`);
      }
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
      if (!buffer.trim()) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: "_No response — please try again._",
          };
          return next;
        });
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "assistant",
          content: "_The connection dropped. Try again._",
        };
        return next;
      });
    } finally {
      setBusy(false);
      sendingRef.current = false;
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {isEmpty ? (
          <div className="space-y-4 py-2">
            {emptyHint && <p className="text-sv-small text-sv-text-2">{emptyHint}</p>}
            {seeds && seeds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {seeds.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => void send(s.prompt)}
                    disabled={busy}
                    className="rounded-sv-pill border border-sv-line px-3 py-1.5 text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-green disabled:opacity-40"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
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
              <div
                key={i}
                className={cn(
                  "rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-3 text-sv-small text-sv-text-2",
                  busy && i === messages.length - 1 && "sv-stream-caret",
                )}
              >
                {m.content ? <Markdown text={m.content} /> : <span className="sv-label">THINKING…</span>}
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
        className="mt-3 flex items-end gap-2 rounded-sv-md border border-sv-line bg-sv-surface-3 px-3 py-2 focus-within:border-sv-green-line"
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
          placeholder={placeholder}
          disabled={busy}
          className="max-h-32 flex-1 resize-none bg-transparent text-sv-small text-sv-text placeholder:text-sv-text-3 focus:outline-none disabled:opacity-60"
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
