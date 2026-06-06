"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

type Msg = { role: "user" | "assistant"; content: string };

// Streamed chat against an admin AI endpoint (e.g. the copilot). Plain-text
// stream; the assistant bubble fills in as tokens arrive. Auth via the admin
// access token. Assistant text is rendered as preformatted text — plug in a
// markdown renderer here if you want rich formatting.
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
      if (!buffer.trim()) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: "No response — please try again." };
          return next;
        });
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: "The connection dropped. Try again." };
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
            {emptyHint && <p className="text-sm text-zinc-400">{emptyHint}</p>}
            {seeds && seeds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {seeds.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => void send(s.prompt)}
                    disabled={busy}
                    className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
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
                <div className="max-w-[85%] rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
                {m.content ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Thinking…</span>
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
        className="mt-3 flex items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-zinc-500"
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
          className="max-h-32 flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-950 disabled:opacity-30"
          style={{ backgroundColor: "var(--admin-accent, #9ef01a)" }}
          aria-label="Send"
        >
          <span className="text-base leading-none">→</span>
        </button>
      </form>
    </div>
  );
}
