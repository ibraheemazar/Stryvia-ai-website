"use client";

import { useState } from "react";
import { AdminChat } from "./insights/AdminChat";

// The "ask anything" admin brain — a floating Copilot available on every admin
// screen. It can see analytics, leads, and conversation summaries and answers
// operational questions to help grow sales.
export function AdminCopilot({ token }: { token: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 end-5 z-40 flex items-center gap-2 rounded-sv-pill border border-sv-green-line bg-sv-surface-1 px-4 py-2.5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.85)] sv-glow"
        aria-label="Open admin copilot"
      >
        <span className="sv-live-dot" />
        <span className="sv-label sv-label--live">ASK COPILOT</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 end-5 z-50 flex h-[min(72vh,580px)] w-[min(92vw,420px)] flex-col rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="sv-live-dot" />
          <span className="sv-label sv-label--live">ADMIN COPILOT</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-lg leading-none text-sv-text-2 transition-colors hover:text-sv-text"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <AdminChat
        token={token}
        endpoint="/api/admin/copilot"
        placeholder="Ask anything — leads, traffic, conversations…"
        emptyHint="I can see your analytics, leads, and recent conversations. Ask me anything — or try one of these:"
        seeds={[
          { label: "How are we doing this week?", prompt: "Give me a quick read on how we're doing this week — traffic, conversations, and leads — and one thing to focus on." },
          { label: "Summarise recent conversations", prompt: "Summarise the most recent conversations and what people are actually asking for. Any patterns or objections?" },
          { label: "Where are leads coming from?", prompt: "Where are our leads and conversations coming from (channels, pages, categories), and what should we double down on?" },
        ]}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
