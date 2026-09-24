"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { adminFetch, fmtDate, verdictTone, VERDICT_LABEL, type ListRow, type Stats } from "./lab-admin-client";

// Submissions list (brief §8): sorted by score, filters, stats strip.
export function LabList({ token }: { token: string }) {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ verdict: "", language: "", status: "", industry: "", q: "", days: "90", awaiting: true });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v && k !== "awaiting") p.set(k, String(v));
    const { status, data } = await adminFetch<{ ok: boolean; rows: ListRow[]; stats: Stats; industries: string[]; reason?: string }>(token, `/api/admin/lab?${p}`);
    setLoading(false);
    if (status === 401) return setError(data.reason === "not_allowlisted" ? "This account isn't on the admin allowlist." : "Sign in again.");
    if (!data.ok) return setError("Couldn't load.");
    setRows(data.rows);
    setStats(data.stats);
    setIndustries(data.industries);
  }, [token, f]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = f.awaiting ? rows.filter((r) => r.awaiting_decision || r.status === "in_progress") : rows;
  const inputCls = "rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none";

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="STARTED" value={stats.sessions_started ?? 0} />
          <Stat label="SUBMITTED" value={stats.sessions_submitted ?? 0} live />
          <Stat label="COMPLETION" value={`${Math.round((stats.completion_rate ?? 0) * 100)}%`} />
          <Stat label="AVG MINUTES" value={stats.avg_session_minutes ?? 0} />
          <Stat label="AVG COST" value={`$${Number(stats.avg_cost_usd ?? 0).toFixed(2)}`} />
          <Stat label="TOTAL COST" value={`$${Number(stats.total_cost_usd ?? 0).toFixed(2)}`} />
        </div>
      )}
      {stats?.verdicts && Object.keys(stats.verdicts).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(stats.verdicts).map(([v, n]) => (
            <span key={v} className={cn("rounded-sv-pill border px-3 py-1 text-sv-small", verdictTone(v))}>
              {VERDICT_LABEL[v] ?? v} · {n}
            </span>
          ))}
          {stats.languages && Object.entries(stats.languages).map(([l, n]) => (
            <span key={l} className="rounded-sv-pill border border-sv-line px-3 py-1 text-sv-small text-sv-text-3">{l.toUpperCase()} · {n}</span>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sv-small text-sv-text-2">
          <input type="checkbox" checked={f.awaiting} onChange={(e) => setF({ ...f, awaiting: e.target.checked })} className="accent-[var(--color-sv-green)]" />
          Awaiting decision only
        </label>
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search name, email, company…" className={cn(inputCls, "min-w-56 flex-1")} />
        <select value={f.verdict} onChange={(e) => setF({ ...f, verdict: e.target.value })} className={inputCls}>
          <option value="">All verdicts</option>
          {Object.entries(VERDICT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} className={inputCls}>
          <option value="">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} className={inputCls}>
          <option value="">AR + EN</option>
          <option value="ar">Arabic</option>
          <option value="en">English</option>
        </select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls}>
          <option value="">All statuses</option>
          {["in_progress", "submitted", "reviewed", "closed"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} className={inputCls}>
          {["7", "30", "90", "365"].map((d) => (
            <option key={d} value={d}>Last {d} days</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-6 text-sv-small text-sv-danger">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-sv-md border border-sv-line">
        <table className="w-full text-sv-small">
          <thead className="sticky top-0 bg-sv-surface-1 text-start">
            <tr className="text-sv-label text-sv-text-3">
              {["Score", "Verdict", "Name", "Industry", "Lang", "Country", "Turns", "Cost", "Submitted", "Status"].map((h) => (
                <th key={h} className={cn("px-3 py-2.5 text-start font-normal", (h === "Score" || h === "Turns" || h === "Cost") && "text-end")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-sv-text-3">Loading…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-sv-text-3">Nothing here yet. Submissions appear as soon as a visitor submits a brief.</td></tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className="border-t border-sv-line transition-colors hover:bg-sv-surface-2">
                <td className="px-3 py-2.5 text-end font-mono tabular-nums">{r.weighted_score != null ? r.weighted_score.toFixed(2) : <span className="text-sv-text-3">{r.assessment_status === "running" || r.assessment_status === "pending" ? "…" : "—"}</span>}</td>
                <td className="px-3 py-2.5">
                  {r.verdict ? <span className={cn("rounded-sv-pill border px-2.5 py-0.5", verdictTone(r.verdict))}>{VERDICT_LABEL[r.verdict] ?? r.verdict}</span> : <span className="text-sv-text-3">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/supadmin/lab/${r.id}`} className="text-sv-text underline-offset-4 hover:text-sv-green hover:underline">
                    <bdi>{r.visitor_name}</bdi>
                  </Link>
                  {r.company && <span className="ms-2 text-sv-text-3"><bdi>{r.company}</bdi></span>}
                  {r.awaiting_decision && <span className="ms-2 rounded-sv-pill border border-sv-green-line px-2 py-0.5 text-sv-label-sm text-sv-green">AWAITING DECISION</span>}
                </td>
                <td className="px-3 py-2.5 text-sv-text-2" dir="auto"><bdi>{r.industry ?? "—"}</bdi></td>
                <td className="px-3 py-2.5 text-sv-text-2">{r.language.toUpperCase()}</td>
                <td className="px-3 py-2.5 text-sv-text-2">{r.country}</td>
                <td className="px-3 py-2.5 text-end font-mono tabular-nums text-sv-text-2">{r.turn_count}</td>
                <td className="px-3 py-2.5 text-end font-mono tabular-nums text-sv-text-2">${r.cost_usd.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-sv-text-2">{fmtDate(r.submitted_at ?? r.created_at)}</td>
                <td className="px-3 py-2.5 text-sv-text-3">{r.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, live }: { label: string; value: string | number; live?: boolean }) {
  return (
    <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-4">
      <p className={cn("sv-label", live && "sv-label--live")}>{label}</p>
      <p className="mt-2 font-display text-sv-h2 tabular-nums text-sv-text">{value}</p>
    </div>
  );
}
