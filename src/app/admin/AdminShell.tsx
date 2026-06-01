"use client";

import { useState } from "react";
import { AdminDashboard } from "./AdminDashboard";
import { MarketingDashboard } from "./marketing/MarketingDashboard";
import { cn } from "@/lib/utils";

// Top-level admin shell: a single header with Leads / Marketing tabs, owning
// sign-out, with each view rendering its own body.
export function AdminShell({
  token,
  email,
  onSignOut,
}: {
  token: string;
  email: string | null;
  onSignOut: () => void;
}) {
  const [view, setView] = useState<"leads" | "marketing">("leads");

  return (
    <div className="min-h-dvh bg-sv-base text-sv-text">
      <header className="flex items-center justify-between gap-4 border-b border-sv-line px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="sv-live-dot" />
            <span className="sv-label sv-label--live">STRYVIA ADMIN</span>
          </div>
          <nav className="flex rounded-sv-sm border border-sv-line p-0.5">
            {(["leads", "marketing"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-sv-sm px-4 py-1.5 text-sv-small capitalize transition-colors",
                  view === v ? "bg-sv-surface-3 text-sv-text" : "text-sv-text-3 hover:text-sv-text",
                )}
              >
                {v}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sv-small text-sv-text-3 sm:block">{email}</span>
          <button
            onClick={onSignOut}
            className="text-sv-small text-sv-text-2 transition-colors hover:text-sv-text"
          >
            Sign out
          </button>
        </div>
      </header>

      {view === "leads" ? (
        <AdminDashboard token={token} />
      ) : (
        <MarketingDashboard token={token} />
      )}
    </div>
  );
}
