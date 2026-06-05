"use client";

import { useState } from "react";
import type { AdminConfig } from "../config";
import { AdminCopilot } from "./AdminCopilot";
import { ThemePicker } from "./ThemePicker";
import { cn } from "./cn";

// Top-level admin shell: one header with a tab per enabled module, owning
// sign-out and the theme picker. Each module renders its own body. The copilot
// floats over everything when enabled.
export function AdminShell({
  config,
  token,
  email,
  onSignOut,
}: {
  config: AdminConfig;
  token: string;
  email: string | null;
  onSignOut: () => void;
}) {
  const modules = config.modules;
  const [activeId, setActiveId] = useState<string>(modules[0]?.id);
  const Active = modules.find((m) => m.id === activeId)?.Component;

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--admin-accent, #9ef01a)" }} />
            <span className="text-xs font-medium uppercase tracking-widest">{config.brand.name}</span>
          </div>
          {modules.length > 1 && (
            <nav className="flex rounded-md border border-zinc-800 p-0.5">
              {modules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveId(m.id)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm capitalize",
                    activeId === m.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-100",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-zinc-500 sm:block">{email}</span>
          <ThemePicker
            accents={config.theme!.accents!}
            defaultMode={config.theme!.defaultMode}
            defaultAccent={config.theme!.defaultAccent}
          />
          <button onClick={onSignOut} className="text-sm text-zinc-400 hover:text-zinc-100">
            Sign out
          </button>
        </div>
      </header>

      {Active ? <Active token={token} /> : <p className="p-8 text-zinc-500">No modules enabled.</p>}

      {config.copilot?.enabled && (
        <AdminCopilot token={token} endpoint={config.copilot.endpoint} seeds={config.copilot.seeds} />
      )}
    </div>
  );
}
