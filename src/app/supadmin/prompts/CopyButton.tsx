"use client";

import { useState } from "react";
import { fillVariables } from "@/lib/prompts/vars";
import { cn } from "@/lib/utils";

// One-click copy, like Claude. When the prompt carries {{variables}}, a small
// fill-in panel opens so the blanks are filled before the finished text lands
// on the clipboard — turning "rewrite the whole thing" into "fill two fields".
export function CopyButton({
  text,
  variables,
  onCopied,
  label = "Copy",
  className,
}: {
  text: string;
  variables: string[];
  onCopied?: () => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function write(finalText: string) {
    try {
      await navigator.clipboard.writeText(finalText);
      setDone(true);
      onCopied?.();
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  function onClick() {
    if (variables.length === 0) {
      void write(text);
    } else {
      setOpen((o) => !o);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sv-sm bg-sv-green px-3 py-1.5 text-sv-small text-sv-on-accent transition-opacity hover:opacity-90",
          className,
        )}
      >
        <span className="font-mono text-xs leading-none">⧉</span>
        {done ? "Copied" : variables.length > 0 ? `${label} (${variables.length})` : label}
      </button>

      {open && variables.length > 0 && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-sv-md border border-sv-line bg-sv-surface-2 p-3 shadow-lg">
          <p className="mb-2 text-sv-small text-sv-text-3">Fill the blanks, then copy.</p>
          <div className="space-y-2">
            {variables.map((v) => (
              <label key={v} className="block">
                <span className="mb-1 block font-mono text-xs text-sv-text-2">{v}</span>
                <input
                  value={values[v] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [v]: e.target.value }))}
                  className="w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-2 py-1.5 text-sv-small text-sv-text focus:border-sv-green-line focus:outline-none"
                  placeholder={`{{${v}}}`}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sv-small text-sv-text-3 hover:text-sv-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void write(fillVariables(text, values));
                setOpen(false);
              }}
              className="rounded-sv-sm bg-sv-green px-3 py-1.5 text-sv-small text-sv-on-accent hover:opacity-90"
            >
              Copy filled
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
