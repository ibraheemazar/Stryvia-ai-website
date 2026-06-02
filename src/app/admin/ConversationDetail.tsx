"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Message = { id: string; role: string; content: string; created_at: string };
type Lead = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: string;
  notes: string | null;
};
type Conversation = {
  id: string;
  created_at: string;
  locale: string;
  page_context: string | null;
  status: string;
  problem_category: string | null;
  summary: string | null;
};

// Conversation detail (Decisions §5): full transcript + metadata, plus the
// editable lead status and notes that track the manual close.
export function ConversationDetail({
  id,
  token,
  onClose,
  onLeadUpdated,
}: {
  id: string;
  token: string;
  onClose: () => void;
  onLeadUpdated: () => void;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [leadStatus, setLeadStatus] = useState("new");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/admin/conversation?id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.conversation) {
        setLoadError(true);
      } else {
        setConversation(data.conversation);
        setMessages(data.messages ?? []);
        setLead(data.lead);
        setNotes(data.lead?.notes ?? "");
        setLeadStatus(data.lead?.status ?? "new");
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveLead() {
    if (!lead || saving) return;
    setSaving(true);
    setSaveState("idle");
    try {
      const res = await fetch("/api/admin/lead", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: lead.id, status: leadStatus, notes }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setSaveState("error");
      } else {
        setSaveState("saved");
        onLeadUpdated();
      }
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto border-s border-sv-line bg-sv-base"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-sv-line bg-sv-base px-6 py-4">
          <span className="sv-label">CONVERSATION</span>
          <button onClick={onClose} className="text-xl text-sv-text-2 hover:text-sv-text">
            ×
          </button>
        </div>

        {loading ? (
          <p className="sv-label p-12 text-center">LOADING</p>
        ) : loadError ? (
          <div className="p-12 text-center">
            <p className="sv-label text-sv-danger">COULDN&apos;T LOAD THIS CONVERSATION</p>
            <button
              onClick={load}
              className="mt-4 rounded-sv-sm border border-sv-line px-4 py-2 text-sv-small text-sv-text-2 hover:text-sv-text"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="p-6">
            {/* metadata */}
            <div className="flex flex-wrap gap-2 text-sv-label-sm uppercase text-sv-text-3">
              {conversation?.problem_category && (
                <span className="rounded-sv-pill border border-sv-line px-2 py-0.5">
                  {conversation.problem_category.replace(/_/g, " ")}
                </span>
              )}
              <span className="rounded-sv-pill border border-sv-line px-2 py-0.5">
                {conversation?.status}
              </span>
              <span className="rounded-sv-pill border border-sv-line px-2 py-0.5">
                {conversation?.locale}
              </span>
              {conversation?.page_context && (
                <span className="rounded-sv-pill border border-sv-line px-2 py-0.5">
                  {conversation.page_context}
                </span>
              )}
            </div>

            {conversation?.summary && (
              <p className="mt-4 text-sv-body text-sv-text-2">{conversation.summary}</p>
            )}

            {/* lead block */}
            {lead && (
              <div className="mt-6 rounded-sv-md border border-sv-green-line bg-sv-surface-1 p-5">
                <p className="sv-label sv-label--live">LEAD</p>
                <p className="mt-2 text-sv-body text-sv-text">
                  {lead.name} · {lead.email}
                  {lead.company ? ` · ${lead.company}` : ""}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    value={leadStatus}
                    onChange={(e) => setLeadStatus(e.target.value)}
                    className="rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-1.5 text-sv-small text-sv-text"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on the close…"
                  className="mt-3 min-h-24 w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={saveLead}
                    disabled={saving}
                    className="rounded-sv-sm bg-sv-green px-4 py-2 text-sv-small font-medium text-sv-ink disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {saveState === "saved" && (
                    <span className="text-sv-small text-sv-green">✓ Saved</span>
                  )}
                  {saveState === "error" && (
                    <span className="text-sv-small text-sv-danger">Save failed — try again</span>
                  )}
                </div>
              </div>
            )}

            {/* transcript */}
            <div className="mt-6 space-y-3">
              <p className="sv-label">TRANSCRIPT</p>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-sv-md border p-3 text-sv-small",
                    m.role === "user"
                      ? "border-sv-line bg-sv-surface-2 text-sv-text"
                      : "border-sv-line bg-sv-surface-1 text-sv-text-2",
                  )}
                >
                  <span className="sv-label-sm sv-label mb-1 block">
                    {m.role === "user" ? "VISITOR" : "STRYVIA"}
                  </span>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
