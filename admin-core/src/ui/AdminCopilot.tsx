"use client";

import { useState } from "react";
import { AdminChat } from "./AdminChat";

// The "ask anything" admin brain — a floating Copilot available on every admin
// screen. The site's copilot endpoint decides what data grounds it (analytics,
// records, etc.); this component is just the UI.
export function AdminCopilot({
  token,
  endpoint = "/api/admin/copilot",
  seeds,
}: {
  token: string;
  endpoint?: string;
  seeds?: { label: string; prompt: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 end-5 z-40 flex items-center gap-2 rounded-full border bg-zinc-900 px-4 py-2.5 shadow-lg"
        style={{ borderColor: "var(--admin-accent, #9ef01a)" }}
        aria-label="Open admin copilot"
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--admin-accent, #9ef01a)" }} />
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-100">Ask Copilot</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 end-5 z-50 flex h-[min(72vh,580px)] w-[min(92vw,420px)] flex-col rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--admin-accent, #9ef01a)" }} />
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-100">Admin Copilot</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-lg leading-none text-zinc-400 hover:text-zinc-100" aria-label="Close">
          ×
        </button>
      </div>
      <AdminChat
        token={token}
        endpoint={endpoint}
        placeholder="Ask anything…"
        emptyHint="I can see this site's data. Ask me anything — or try one of these:"
        seeds={
          seeds ?? [
            { label: "How are we doing this week?", prompt: "Give me a quick read on how we're doing this week, and one thing to focus on." },
            { label: "What's coming in?", prompt: "Summarise the most recent activity and any patterns worth noticing." },
          ]
        }
        className="min-h-0 flex-1"
      />
    </div>
  );
}
