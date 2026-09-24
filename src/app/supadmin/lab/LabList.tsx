"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { adminFetch, fmtDate, rowsToCsv, verdictTone, VERDICT_LABEL, type ListRow, type Stats } from "./lab-admin-client";

// Submissions list (brief §8): sorted by score, filters, stats strip,
// contact details in the row, CSV export of what is on screen.
type View = "all" | "awaiting" | "in_progress" | "decided";
const VIEWS: Array<[View, string]> = [["all", "All"], ["awaiting", "Needs decision"], ["in_progress", "In progress"], ["decided", "Decided"]];

export function LabList({ token }: { token: string }) {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ verdict: "", language: "", status: "", industry: "", q: "", days: "365" });
  const [view, setView] = useState<View>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
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

  const visible = rows.filter((r) => {
    if (view === "awaiting") return r.awaiting_decision;
    if (view === "in_progress") return r.status === "in_progress";
    if (view === "decided") return r.has_decision;
    return true;
  });
  const counts = {
    all: rows.length,
    awaiting: rows.filter((r) => r.awaiting_decision).length,
    in_progress: rows.filter((r) => r.status === "in_progress").length,
    decided: rows.filter((r) => r.has_decision).length,
  };

  function exportCsv() {
    const blob = new Blob([rowsToCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `idea-lab-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
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
        <div className="flex rounded-sv-sm border border-sv-line p-0.5">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-sv-sm px-3 py-1.5 text-sv-small transition-colors", view === v ? "bg-sv-surface-3 text-sv-text" : "text-sv-text-3 hover:text-sv-text")}>
              {label} <span className="font-mono tabular-nums text-sv-text-3">{counts[v]}</span>
            </button>
          ))}
        </div>
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
        <button type="button" onClick={exportCsv} disabled={visible.length === 0} className="min-h-9 rounded-sv-sm border border-sv-line-strong px-3 text-sv-small text-sv-text transition-colors hover:border-sv-green-line hover:text-sv-green disabled:opacity-50">
          Export CSV ({visible.length})
        </button>
      </div>

      {error && <p className="mt-6 text-sv-small text-sv-danger">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-sv-md border border-sv-line">
        <table className="w-full text-sv-small">
          <thead className="sticky top-0 bg-sv-surface-1 text-start">
            <tr className="text-sv-label text-sv-text-3">
              {["Score", "Verdict", "Name", "Contact", "Industry", "Lang", "Country", "Turns", "Cost", "Submitted", "Status"].map((h) => (
                <th key={h} className={cn("px-3 py-2.5 text-start font-normal", (h === "Score" || h === "Turns" || h === "Cost") && "text-end")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-sv-text-3">Loading…</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-sv-text-3">Nothing here yet. Sessions appear as soon as a visitor starts one.</td></tr>
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
                  {r.company && <span className="ms-2 text-sv-text-3"><bdi>{r.company}</bdi>{r.role ? ` · ${r.role}` : ""}</span>}
                  {r.awaiting_decision && <span className="ms-2 rounded-sv-pill border border-sv-green-line px-2 py-0.5 text-sv-label-sm text-sv-green">NEEDS DECISION</span>}
                  {r.decision && <span className="ms-2 rounded-sv-pill border border-sv-line px-2 py-0.5 text-sv-label-sm text-sv-text-3">{r.decision.replace("_", " ").toUpperCase()}</span>}
                </td>
                <td className="px-3 py-2.5 text-sv-text-2">
                  <a href={`mailto:${r.email}`} className="block hover:text-sv-green"><bdi>{r.email}</bdi></a>
                  <a href={`https://wa.me/${r.phone_e164.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="block font-mono text-sv-label text-sv-text-3 hover:text-sv-green"><bdi>{r.phone_e164}</bdi></a>
                </td>
                <td className="px-3 py-2.5 text-sv-text-2" dir="auto"><bdi>{r.industry ?? "—"}</bdi></td>
                <td className="px-3 py-2.5 text-sv-text-2">{r.language.toUpperCase()}</td>
                <td className="px-3 py-2.5 text-sv-text-2">{r.country}</td>
                <td className="px-3 py-2.5 text-end font-mono tabular-nums text-sv-text-2">{r.turn_count}</td>
                <td className="px-3 py-2.5 text-end font-mono tabular-nums text-sv-text-2">${r.cost_usd.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-sv-text-2">{r.submitted_at ? fmtDate(r.submitted_at) : <span className="text-sv-text-3">started {fmtDate(r.created_at)}</span>}</td>
                <td className="px-3 py-2.5 text-sv-text-3">{r.status.replace("_", " ")}{r.status === "in_progress" ? ` · ${r.phase}` : ""}</td>
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
