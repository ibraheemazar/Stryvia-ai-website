"use client";

import { useCallback, useEffect, useState } from "react";
import { ConversationDetail } from "@/app/admin/ConversationDetail";
import { cn } from "@/lib/utils";

type ConversationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  locale: string;
  page_context: string | null;
  status: string;
  problem_category: string | null;
  summary: string | null;
  converted: boolean;
  lead: { name: string; email: string; company: string | null; status: string } | null;
};

type Insights = {
  total: number;
  converted: number;
  conversionRate: number;
  categoryCounts: Record<string, number>;
  statusCounts: Record<string, number>;
};

export function AdminDashboard({
  token,
}: {
  token: string;
}) {
  const [view, setView] = useState<"inbox" | "all">("inbox");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ view });
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    try {
      const res = await fetch(`/api/admin/data?${params.toString()}`, {
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

  const topCategories = insights
    ? Object.entries(insights.categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-6 py-8">
        {/* Insights */}
        {insights && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="CONVERSATIONS" value={insights.total} />
            <Stat label="CONVERTED" value={insights.converted} live />
            <Stat label="CONVERSION RATE" value={`${insights.conversionRate}%`} live />
            <Stat
              label="ACTIVE / SCOPED"
              value={(insights.statusCounts.active || 0) + (insights.statusCounts.scoped || 0)}
            />
          </div>
        )}

        {topCategories.length > 0 && (
          <div className="mt-4 rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
            <p className="sv-label mb-3">TOP PROBLEM CATEGORIES</p>
            <div className="flex flex-wrap gap-2">
              {topCategories.map(([cat, count]) => (
                <span
                  key={cat}
                  className="rounded-sv-pill border border-sv-line px-3 py-1 text-sv-small text-sv-text-2"
                >
                  {cat.replace(/_/g, " ")} · {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* controls */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex rounded-sv-sm border border-sv-line p-0.5">
            {(["inbox", "all"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-sv-sm px-4 py-1.5 text-sv-small transition-colors",
                  view === v ? "bg-sv-surface-3 text-sv-text" : "text-sv-text-3 hover:text-sv-text",
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
            className="flex-1 min-w-48 rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2 text-sv-small text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text focus:border-sv-green-line focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="scoped">Scoped</option>
            <option value="converted">Converted</option>
            <option value="escalated">Escalated</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>

        {/* list */}
        <div className="mt-6">
          {error && <p className="text-sv-small text-sv-danger">{error}</p>}
          {loading ? (
            <p className="sv-label py-12 text-center">LOADING</p>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sv-small text-sv-text-3">
              Nothing here yet.
            </p>
          ) : (
            <div className="divide-y divide-sv-line border-y border-sv-line">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setOpenId(row.id)}
                  className="flex w-full items-center gap-4 py-4 text-start transition-colors hover:bg-sv-surface-1"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      row.converted ? "bg-sv-green" : "bg-sv-line-strong",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sv-body text-sv-text">
                      {row.lead ? `${row.lead.name} · ${row.lead.email}` : row.summary || "Untitled conversation"}
                    </p>
                    <p className="truncate text-sv-small text-sv-text-3">
                      {row.lead ? row.summary : row.page_context || "—"}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-sv-label-sm uppercase tracking-wider text-sv-text-3 sm:block">
                    {row.problem_category?.replace(/_/g, " ") || "—"}
                  </span>
                  <span className="shrink-0 rounded-sv-pill border border-sv-line px-2 py-0.5 text-sv-label-sm uppercase text-sv-text-2">
                    {row.status}
                  </span>
                  <span className="hidden shrink-0 text-sv-label-sm uppercase text-sv-text-3 md:block">
                    {row.locale}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {openId && (
        <ConversationDetail
          id={openId}
          token={token}
          onClose={() => setOpenId(null)}
          onLeadUpdated={load}
        />
      )}
    </>
  );
}

function Stat({ label, value, live }: { label: string; value: number | string; live?: boolean }) {
  return (
    <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
      <p className={cn("sv-label", live && "sv-label--live")}>{label}</p>
      <p className={cn("mt-2 font-display text-3xl", live ? "text-sv-green" : "text-sv-text")}>
        {value}
      </p>
    </div>
  );
}
