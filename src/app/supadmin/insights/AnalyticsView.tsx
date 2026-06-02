"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AdminChat } from "./AdminChat";

// Local types mirror the JSON returned by /api/admin/insights. Declared here so
// this client component never imports a server-only module.
type Ga4 = {
  configured: boolean;
  error?: string;
  range: string;
  overview: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    conversions: number;
    engagementRate: number;
    averageSessionDuration: number;
    eventCount: number;
  };
  trend: { date: string; sessions: number; users: number; conversions: number }[];
  pages: { path: string; title: string; views: number; users: number; conversions: number; avgEngagement: number }[];
  acquisition: { channel: string; sessions: number; users: number; conversions: number }[];
  events: { name: string; count: number }[];
  devices: { device: string; sessions: number }[];
};
type FirstParty = {
  totals: { conversations: number; leads: number; converted: number; conversionRate: number; last7Leads: number; last7Conversations: number };
  funnel: { label: string; value: number }[];
  byCategory: { category: string; conversations: number; converted: number }[];
  bySource: { source: string; conversations: number; converted: number }[];
  byLocale: { locale: string; count: number }[];
} | null;
type Snapshot = { range: string; generatedAt: string; ga4: Ga4; firstParty: FirstParty };

const RANGES: { id: "7d" | "30d" | "90d"; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}
function duration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function AnalyticsView({ token, onClose }: { token: string; onClose: () => void }) {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (fresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/insights?range=${range}${fresh ? "&fresh=1" : ""}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.reason === "not_allowlisted" ? "Not on the admin allowlist." : "Couldn't load analytics.");
          return;
        }
        setSnap(data.snapshot as Snapshot);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [token, range],
  );

  useEffect(() => {
    load();
  }, [load]);

  const ga4 = snap?.ga4;
  const fp = snap?.firstParty ?? null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-sv-base text-sv-text">
      {/* Header */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-sv-line bg-sv-base/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-sv-text-2 transition-colors hover:text-sv-text" aria-label="Back">
            ←
          </button>
          <span className="sv-label sv-label--live">ANALYTICS</span>
          <span className="hidden text-sv-small text-sv-text-3 sm:inline">Google Analytics 4 · funnel</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-sv-sm border border-sv-line p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded-sv-sm px-3 py-1 text-sv-small transition-colors",
                  range === r.id ? "bg-sv-surface-3 text-sv-text" : "text-sv-text-3 hover:text-sv-text",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            className="rounded-sv-sm border border-sv-line px-3 py-1.5 text-sv-small text-sv-text-2 transition-colors hover:text-sv-text"
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {loading && !snap ? (
          <p className="sv-label py-20 text-center">LOADING</p>
        ) : error ? (
          <p className="py-20 text-center text-sv-small text-sv-danger">{error}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* ── Metrics column ── */}
            <div className="space-y-6">
              {ga4 && !ga4.configured && (
                <Note>GA4 isn&apos;t connected yet — showing first-party funnel data only.</Note>
              )}
              {ga4?.error && (
                <Note danger>GA4 connected, but the last fetch errored ({ga4.error}). Showing what we have.</Note>
              )}
              {ga4?.configured && !ga4.error && ga4.overview.sessions === 0 && (
                <Note>GA4 is connected but hasn&apos;t recorded sessions for this range yet — collection started recently.</Note>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Kpi label="SESSIONS" value={fmt(ga4?.overview.sessions ?? 0)} />
                <Kpi label="USERS" value={fmt(ga4?.overview.activeUsers ?? 0)} sub={`${fmt(ga4?.overview.newUsers ?? 0)} new`} />
                <Kpi label="PAGE VIEWS" value={fmt(ga4?.overview.screenPageViews ?? 0)} />
                <Kpi label="GA4 CONVERSIONS" value={fmt(ga4?.overview.conversions ?? 0)} live />
                <Kpi label="ENGAGEMENT" value={`${Math.round((ga4?.overview.engagementRate ?? 0) * 100)}%`} />
                <Kpi label="AVG SESSION" value={duration(ga4?.overview.averageSessionDuration ?? 0)} />
                <Kpi label="CONVERSATIONS" value={fmt(fp?.totals.conversations ?? 0)} sub={`${fmt(fp?.totals.last7Conversations ?? 0)} last 7d`} />
                <Kpi label="LEADS" value={fmt(fp?.totals.leads ?? 0)} sub={`${fp?.totals.conversionRate ?? 0}% conv.`} live />
              </div>

              {/* Trend */}
              {ga4 && ga4.trend.length > 1 && (
                <Panel title="SESSIONS TREND">
                  <Spark data={ga4.trend.map((t) => t.sessions)} />
                </Panel>
              )}

              {/* First-party funnel */}
              {fp && (
                <Panel title="FUNNEL (FIRST-PARTY)">
                  <Bars items={fp.funnel.map((f) => ({ label: f.label, value: f.value }))} />
                </Panel>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                {/* Top pages */}
                <Panel title="TOP PAGES">
                  {ga4 && ga4.pages.length > 0 ? (
                    <table className="w-full text-sv-small">
                      <thead>
                        <tr className="text-sv-text-3">
                          <th className="pb-2 text-start font-normal">Path</th>
                          <th className="pb-2 text-end font-normal">Views</th>
                          <th className="pb-2 text-end font-normal">Users</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ga4.pages.slice(0, 12).map((p) => (
                          <tr key={p.path} className="border-t border-sv-line">
                            <td className="truncate py-1.5 pe-2 text-sv-text-2" title={p.path}>{p.path || "/"}</td>
                            <td className="py-1.5 text-end font-mono text-sv-text">{fmt(p.views)}</td>
                            <td className="py-1.5 text-end font-mono text-sv-text-2">{fmt(p.users)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <Muted>No page data yet.</Muted>
                  )}
                </Panel>

                {/* Acquisition */}
                <Panel title="ACQUISITION (CHANNELS)">
                  {ga4 && ga4.acquisition.length > 0 ? (
                    <Bars items={ga4.acquisition.slice(0, 8).map((a) => ({ label: a.channel, value: a.sessions }))} />
                  ) : (
                    <Muted>No channel data yet.</Muted>
                  )}
                </Panel>

                {/* Events */}
                <Panel title="TOP EVENTS">
                  {ga4 && ga4.events.length > 0 ? (
                    <Bars items={ga4.events.slice(0, 8).map((e) => ({ label: e.name, value: e.count }))} />
                  ) : (
                    <Muted>No events yet.</Muted>
                  )}
                </Panel>

                {/* Categories (first-party) */}
                <Panel title="WHAT THE MARKET ASKS FOR">
                  {fp && fp.byCategory.length > 0 ? (
                    <Bars items={fp.byCategory.slice(0, 8).map((c) => ({ label: c.category.replace(/_/g, " "), value: c.conversations }))} />
                  ) : (
                    <Muted>No conversations yet.</Muted>
                  )}
                </Panel>
              </div>
            </div>

            {/* ── AI column ── */}
            <div className="lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
              <div className="flex h-full flex-col rounded-sv-md border border-sv-green-line bg-sv-surface-1 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="sv-live-dot" />
                  <span className="sv-label sv-label--live">ASK THE INTELLIGENCE</span>
                </div>
                <AdminChat
                  token={token}
                  endpoint="/api/admin/insights/ask"
                  range={range}
                  placeholder="Ask about your traffic, pages, funnel…"
                  emptyHint="Get a full report, or ask anything about this data — what's working, where you're losing people, what to fix to grow sales."
                  seeds={[
                    { label: "Generate full report", prompt: "Generate a full performance report from the data: what's working, where we're losing people, and the top 3 prioritised actions to increase sales. Be specific and cite the numbers." },
                    { label: "Best converting pages?", prompt: "Which pages and channels convert best, and which underperform? What should I change?" },
                    { label: "Where do we lose people?", prompt: "Walk through the funnel and tell me where we lose the most people and the single highest-impact fix." },
                  ]}
                  className="min-h-0 flex-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── presentational helpers ──
function Kpi({ label, value, sub, live }: { label: string; value: string; sub?: string; live?: boolean }) {
  return (
    <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-4">
      <p className={cn("sv-label sv-label-sm", live && "sv-label--live")}>{label}</p>
      <p className={cn("mt-2 font-display text-2xl", live ? "text-sv-green" : "text-sv-text")}>{value}</p>
      {sub && <p className="mt-1 text-sv-label-sm text-sv-text-3">{sub}</p>}
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
      <p className="sv-label mb-4">{title}</p>
      {children}
    </section>
  );
}
function Bars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <Muted>No data.</Muted>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-36 truncate text-sv-small text-sv-text-2" title={it.label}>{it.label}</span>
          <div className="h-3.5 flex-1 overflow-hidden rounded-sv-sm bg-sv-surface-2">
            <div className="h-full bg-sv-green-soft" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
          <span className="w-12 text-end font-mono text-sv-small text-sv-text">{fmt(it.value)}</span>
        </div>
      ))}
    </div>
  );
}
function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return <Muted>Not enough data for a trend yet.</Muted>;
  const max = Math.max(1, ...data);
  const w = 100;
  const h = 30;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--color-sv-green)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
function Note({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <p className={cn("rounded-sv-sm border px-4 py-2 text-sv-small", danger ? "border-sv-danger/40 text-sv-danger" : "border-sv-line text-sv-text-2")}>
      {children}
    </p>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sv-small text-sv-text-3">{children}</p>;
}
