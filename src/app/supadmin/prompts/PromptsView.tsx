"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Prompt } from "@/lib/prompts/types";
import { PromptEditor } from "./PromptEditor";
import { PromptMaker } from "./PromptMaker";
import { cn } from "@/lib/utils";

type Mode = "chat" | "editor";

// The Prompt library. A simple two-pane workspace: a left sidebar to store,
// search and pick saved prompts, and a main area that is either the AI maker
// chat (build a new prompt) or the editor (view / edit / copy a prompt).
export function PromptsView({ token }: { token: string }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (q: string, cat: string | null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (cat) params.set("category", cat);
        const res = await fetch(`/api/admin/prompts?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json?.ok) setPrompts(json.prompts as Prompt[]);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load("", null);
  }, [load]);

  // Debounced search-as-you-type.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(query, category), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, category, load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of prompts) if (p.category) set.add(p.category);
    return [...set].sort();
  }, [prompts]);

  function openPrompt(p: Prompt) {
    setEditing(p);
    setSelectedId(p.id);
    setMode("editor");
  }

  function newBlank() {
    setEditing(null);
    setSelectedId(null);
    setMode("editor");
  }

  function openMaker() {
    setSelectedId(null);
    setMode("chat");
  }

  function onSaved(p: Prompt) {
    setPrompts((list) => {
      const i = list.findIndex((x) => x.id === p.id);
      if (i === -1) return [p, ...list];
      const next = [...list];
      next[i] = p;
      return next;
    });
    setEditing(p);
    setSelectedId(p.id);
    setMode("editor");
  }

  function onDeleted(id: string) {
    setPrompts((list) => list.filter((p) => p.id !== id));
    setEditing(null);
    setSelectedId(null);
    setMode("chat");
  }

  return (
    <div className="flex h-[calc(100dvh-65px)] min-h-0">
      {/* Sidebar: search + library */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-sv-line">
        <div className="space-y-3 border-b border-sv-line p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openMaker}
              className={cn(
                "flex-1 rounded-sv-sm px-3 py-1.5 text-sv-small transition-colors",
                mode === "chat" ? "bg-sv-green text-sv-on-accent" : "border border-sv-line text-sv-text-2 hover:text-sv-text",
              )}
            >
              ✦ AI Maker
            </button>
            <button
              type="button"
              onClick={newBlank}
              className="rounded-sv-sm border border-sv-line px-3 py-1.5 text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-green"
            >
              + Blank
            </button>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords or phrases…"
            className="w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
          />
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={cn(
                  "rounded-sv-pill border px-2 py-0.5 text-xs transition-colors",
                  category === null ? "border-sv-green-line text-sv-green" : "border-sv-line text-sv-text-3 hover:text-sv-text",
                )}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c === category ? null : c)}
                  className={cn(
                    "rounded-sv-pill border px-2 py-0.5 text-xs transition-colors",
                    category === c ? "border-sv-green-line text-sv-green" : "border-sv-line text-sv-text-3 hover:text-sv-text",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-3 text-sv-small text-sv-text-3">Loading…</p>
          ) : prompts.length === 0 ? (
            <p className="p-3 text-sv-small text-sv-text-3">
              {query || category ? "No matches." : "No prompts yet — make one with the AI Maker."}
            </p>
          ) : (
            <ul className="space-y-1">
              {prompts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openPrompt(p)}
                    className={cn(
                      "w-full rounded-sv-sm px-3 py-2 text-left transition-colors",
                      selectedId === p.id ? "bg-sv-surface-3" : "hover:bg-sv-surface-2",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {p.favorite && <span className="text-xs text-sv-green">★</span>}
                      <span className="truncate text-sv-small text-sv-text">{p.title}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-sv-text-3">
                      {p.category && <span className="truncate">{p.category}</span>}
                      {p.variables.length > 0 && <span className="font-mono">· {p.variables.length} var</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-sv-line px-3 py-2 text-xs text-sv-text-3">
          {prompts.length} prompt{prompts.length === 1 ? "" : "s"}
        </div>
      </aside>

      {/* Main area */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {mode === "chat" ? (
          <PromptMaker token={token} onSaved={onSaved} />
        ) : (
          <PromptEditor key={selectedId ?? "new"} token={token} prompt={editing} onSaved={onSaved} onDeleted={onDeleted} />
        )}
      </section>
    </div>
  );
}
