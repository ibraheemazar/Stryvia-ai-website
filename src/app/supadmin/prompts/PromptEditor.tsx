"use client";

import { useEffect, useState } from "react";
import { extractVariables } from "@/lib/prompts/vars";
import type { Classification, Prompt } from "@/lib/prompts/types";
import { CopyButton } from "./CopyButton";

// View / edit a single prompt (or compose a blank one). Save persists via the
// CRUD route; "Improve with AI" asks Claude for a cleaner rewrite + filing,
// which the operator applies selectively. Copy is one-click with variable
// fill-in and bumps the use counter.
export function PromptEditor({
  token,
  prompt,
  onSaved,
  onDeleted,
}: {
  token: string;
  prompt: Prompt | null;
  onSaved: (p: Prompt) => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Classification | null>(null);

  useEffect(() => {
    setTitle(prompt?.title ?? "");
    setBody(prompt?.body ?? "");
    setCategory(prompt?.category ?? "");
    setTagsText((prompt?.tags ?? []).join(", "));
    setFavorite(prompt?.favorite ?? false);
    setSuggestion(null);
  }, [prompt]);

  const variables = extractVariables(body);
  const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);

  async function save() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: prompt ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          prompt
            ? { id: prompt.id, title, body, category, tags }
            : { title, body, category, tags, classify: true, improve: false },
        ),
      });
      const json = await res.json();
      if (json?.ok && json.prompt) onSaved(json.prompt as Prompt);
    } finally {
      setBusy(false);
    }
  }

  async function improve() {
    if (!body.trim()) return;
    setBusy(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/admin/prompts/classify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ body, improve: true }),
      });
      const json = await res.json();
      if (json?.ok && json.classification) setSuggestion(json.classification as Classification);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!prompt) return setFavorite((f) => !f);
    const next = !favorite;
    setFavorite(next);
    const res = await fetch("/api/admin/prompts", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: prompt.id, favorite: next }),
    });
    const json = await res.json();
    if (json?.ok && json.prompt) onSaved(json.prompt as Prompt);
  }

  async function remove() {
    if (!prompt) return;
    if (!confirm("Delete this prompt?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/prompts?id=${prompt.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.ok) onDeleted(prompt.id);
    } finally {
      setBusy(false);
    }
  }

  function bumpUse() {
    if (!prompt) return;
    void fetch("/api/admin/prompts", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: prompt.id, bump: true }),
    });
  }

  const inputCls =
    "w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text focus:border-sv-green-line focus:outline-none";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Prompt title"
            className="flex-1 bg-transparent text-sv-h3 text-sv-text placeholder:text-sv-text-3 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void toggleFavorite()}
            title="Favorite"
            className={favorite ? "text-sv-green" : "text-sv-text-3 hover:text-sv-text"}
          >
            <span className="text-lg leading-none">{favorite ? "★" : "☆"}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sv-small text-sv-text-3">Category</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Auto if left blank"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sv-small text-sv-text-3">Tags (comma-separated)</span>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="auto if left blank"
              className={inputCls}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sv-small text-sv-text-3">Prompt</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your prompt. Use {{variables}} for the parts that change between uses."
            rows={12}
            className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
          />
        </label>

        {variables.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sv-small text-sv-text-3">Variables:</span>
            {variables.map((v) => (
              <span key={v} className="rounded-sv-pill border border-sv-line px-2 py-0.5 font-mono text-xs text-sv-text-2">
                {v}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-sv-line pt-4">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !body.trim()}
            className="rounded-sv-sm bg-sv-green px-4 py-1.5 text-sv-small text-sv-on-accent transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            {prompt ? "Save changes" : "Save prompt"}
          </button>
          <CopyButton text={body} variables={variables} onCopied={bumpUse} />
          <button
            type="button"
            onClick={() => void improve()}
            disabled={busy || !body.trim()}
            className="rounded-sv-sm border border-sv-line px-3 py-1.5 text-sv-small text-sv-text-2 transition-colors hover:border-sv-green-line hover:text-sv-green disabled:opacity-40"
          >
            {busy ? "Working…" : "Improve with AI"}
          </button>
          {prompt && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="ml-auto text-sv-small text-sv-text-3 transition-colors hover:text-sv-danger disabled:opacity-40"
            >
              Delete
            </button>
          )}
        </div>

        {suggestion && (
          <div className="space-y-3 rounded-sv-md border border-sv-green-line bg-sv-surface-2/50 p-4">
            <p className="sv-label sv-label--live">AI SUGGESTION</p>
            <div className="flex flex-wrap items-center gap-2 text-sv-small text-sv-text-2">
              <span>Category: <strong className="text-sv-text">{suggestion.category}</strong></span>
              <span>· Tags: <strong className="text-sv-text">{suggestion.tags.join(", ") || "—"}</strong></span>
              <button
                type="button"
                onClick={() => {
                  if (!category) setCategory(suggestion.category);
                  if (!tagsText.trim()) setTagsText(suggestion.tags.join(", "));
                  if (suggestion.title && !title) setTitle(suggestion.title);
                }}
                className="rounded-sv-sm border border-sv-line px-2 py-1 text-xs text-sv-text-2 hover:text-sv-green"
              >
                Apply filing
              </button>
            </div>
            {suggestion.improved ? (
              <div className="space-y-2">
                <p className="text-sv-small text-sv-text-3">Improved prompt:</p>
                <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-sv-sm border border-sv-line bg-sv-surface-3 p-3 font-mono text-xs text-sv-text">
                  {suggestion.improved}
                </pre>
                <button
                  type="button"
                  onClick={() => setBody(suggestion.improved!)}
                  className="rounded-sv-sm bg-sv-green px-3 py-1.5 text-sv-small text-sv-on-accent hover:opacity-90"
                >
                  Use improved version
                </button>
              </div>
            ) : (
              <p className="text-sv-small text-sv-text-3">This prompt already looks good — no rewrite suggested.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
