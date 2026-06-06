"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "../../ui/cn";
import type { ConversationRow, CrmInsights } from "./types";

// CRM dashboard: conversation inbox with insight cards, search, filters, and
// lead scoring. Reads GET /api/admin/crm/data (wired by the host app to
// getCrmData). The conversation-detail drawer + on-demand AI analysis can be
// ported next from the original ConversationDetail.
export function CrmDashboard({ token }: { token: string }) {
  const [view, setView] = useState<"inbox" | "all">("inbox");
  const [insights, setInsights] = useState<CrmInsights | null>(null);
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hottest, setHottest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ view });
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    try {
      const res = await fetch(`/api/admin/crm/data?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) {
        setError(
          data.reason === "not_allowlisted"
            ? "This account isn't on the admin allowlist."
            : "Couldn't load. Check your access.",
        );
        setRows([]);
        return;
      }
      setInsights(data.insights);
      setRows(data.conversations);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [token, view, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedRows = hottest ? [...rows].sort((a, b) => b.score - a.score) : rows;
  const topCategories = insights
    ? Object.entries(insights.categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8">
      {insights && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Conversations" value={insights.total} />
          <Stat label="Converted" value={insights.converted} accent />
          <Stat label="Conversion rate" value={`${insights.conversionRate}%`} accent />
          <Stat
            label="Active / scoped"
            value={(insights.statusCounts.active || 0) + (insights.statusCounts.scoped || 0)}
          />
        </div>
      )}

      {topCategories.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Top problem categories</p>
          <div className="flex flex-wrap gap-2">
            {topCategories.map(([cat, count]) => (
              <span key={cat} className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-400">
                {cat.replace(/_/g, " ")} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-zinc-800 p-0.5">
          {(["inbox", "all"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm",
                view === v ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-100",
              )}
            >
              {v === "inbox" ? "Leads" : "All conversations"}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search transcripts…"
          className="min-w-48 flex-1 rounded-md border border-zinc-800 bg-zinc-800 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="scoped">Scoped</option>
          <option value="converted">Converted</option>
          <option value="escalated">Escalated</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <button
          onClick={() => setHottest((v) => !v)}
          aria-pressed={hottest}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            hottest ? "border-zinc-400 text-zinc-100" : "border-zinc-800 text-zinc-500 hover:text-zinc-100",
          )}
        >
          Hottest first
        </button>
      </div>

      <div className="mt-6">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading ? (
          <p className="py-12 text-center text-xs uppercase tracking-wider text-zinc-500">Loading</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">Nothing here yet.</p>
        ) : (
          <div className="divide-y divide-zinc-800 border-y border-zinc-800">
            {sortedRows.map((row) => (
              <div key={row.id} className="flex w-full items-center gap-4 py-4 text-start">
                <span
                  title={`Lead score ${row.score}`}
                  className={cn(
                    "w-9 shrink-0 text-center font-mono text-xs",
                    row.score >= 70 ? "text-zinc-100" : row.score >= 40 ? "text-zinc-300" : "text-zinc-600",
                  )}
                  style={row.score >= 70 ? { color: "var(--admin-accent, #9ef01a)" } : undefined}
                >
                  {row.score}
                </span>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.converted ? "var(--admin-accent, #9ef01a)" : "#52525b" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">
                    {row.lead ? `${row.lead.name} · ${row.lead.email}` : row.summary || "Untitled conversation"}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {row.lead ? row.summary : row.page_context || "—"}
                  </p>
                </div>
                <span className="hidden shrink-0 text-xs uppercase tracking-wider text-zinc-500 sm:block">
                  {row.problem_category?.replace(/_/g, " ") || "—"}
                </span>
                <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-xs uppercase text-zinc-300">
                  {row.status}
                </span>
                <span className="hidden shrink-0 text-xs uppercase text-zinc-500 md:block">{row.locale}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold" style={accent ? { color: "var(--admin-accent, #9ef01a)" } : undefined}>
        {value}
      </p>
    </div>
  );
}
