"use client";

import { humanSize } from "@/lib/lab/attachment-policy";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { adminFetch, fmtDate, verdictTone, DECISION_LABEL, DIMENSION_LABEL, VERDICT_LABEL, type Detail } from "./lab-admin-client";

// Submission detail (brief §8): brief, scorecard with evidence, red flags,
// proposed plan, transcript, slot state, notes, decision actions with drafted
// emails the admin edits before sending. Visitor content renders with
// dir="auto" and the Arabic face so mixed sessions read correctly.

type Action = "book_call" | "request_quote" | "decline";

export function LabDetail({ token, id }: { token: string; id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"brief" | "score" | "transcript" | "state">("brief");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ action: Action; subject: string; body: string; source: string; hint: string } | null>(null);
  const [preview, setPreview] = useState<{ to: string; subject: string; html: string; text: string; noContact: boolean; test: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { status, data } = await adminFetch<Detail & { ok: boolean; reason?: string }>(token, `/api/admin/lab/${id}`);
    if (status === 401) return setError(data.reason === "not_allowlisted" ? "This account isn't on the admin allowlist." : "Sign in again.");
    if (status === 404) return setError("Not found.");
    if (!data.ok) return setError("Couldn't load.");
    setD(data);
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function act(label: string, fn: () => Promise<{ status: number; data: { ok: boolean; error?: string } }>) {
    setBusy(label);
    try {
      const { data } = await fn();
      if (!data.ok) flash(`Failed: ${data.error ?? "error"}`);
      else flash(`${label} done`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function startDraft(action: Action) {
    setBusy("draft");
    const { data } = await adminFetch<{ ok: boolean; draft?: { subject: string; body: string; source: string } }>(token, `/api/admin/lab/${id}/draft-email`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (data.ok && data.draft) setDraft({ action, ...data.draft, hint: "" });
    else flash("Could not draft");
  }

  async function redraft() {
    if (!draft) return;
    setBusy("draft");
    const { data } = await adminFetch<{ ok: boolean; draft?: { subject: string; body: string; source: string } }>(token, `/api/admin/lab/${id}/draft-email`, {
      method: "POST",
      body: JSON.stringify({ action: draft.action, hint: draft.hint || null }),
    });
    setBusy(null);
    if (data.ok && data.draft) setDraft({ ...draft, ...data.draft });
  }

  // Step 1: render the exact email server-side (nothing leaves).
  async function previewSend() {
    if (!draft) return;
    setBusy("preview");
    const { data } = await adminFetch<{ ok: boolean; preview?: { to: string; subject: string; html: string; text: string }; noContact?: boolean; test?: boolean; error?: string }>(
      token,
      `/api/admin/lab/${id}/send-email`,
      { method: "POST", body: JSON.stringify({ mode: "preview", action: draft.action, subject: draft.subject, body: draft.body }) },
    );
    setBusy(null);
    if (data.ok && data.preview) setPreview({ ...data.preview, noContact: Boolean(data.noContact), test: Boolean(data.test) });
    else flash(data.error === "not_reviewer" ? "Your account is not authorised to record decisions." : `Could not preview: ${data.error ?? "error"}`);
  }

  // Step 2: an explicit, separate confirmation actually sends and records the decision.
  async function confirmSend(overrideNoContact: boolean) {
    if (!draft || !preview) return;
    if (!window.confirm(`Send this "${DECISION_LABEL[draft.action]}" email to ${preview.to} now? This is the only thing the visitor will receive, and it records your decision.`)) return;
    await act("Email", () =>
      adminFetch(token, `/api/admin/lab/${id}/send-email`, {
        method: "POST",
        body: JSON.stringify({ mode: "send", confirmed: true, overrideNoContact, action: draft.action, subject: draft.subject, body: draft.body }),
      }),
    );
    setDraft(null);
    setPreview(null);
  }

  async function markHold() {
    if (!window.confirm("Record 'on hold' for this session? Nothing is sent to the visitor.")) return;
    await act("Hold", () => adminFetch(token, `/api/admin/lab/${id}/decision`, { method: "POST", body: JSON.stringify({ decision: "hold", confirmed: true }) }));
  }

  function openPacket(format: "md" | "html") {
    void (async () => {
      const res = await fetch(`/api/admin/lab/${id}/packet?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (format === "html") window.open(url, "_blank", "noopener");
      else {
        const a = document.createElement("a");
        a.href = url;
        a.download = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "packet.md";
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    })();
  }

  if (error) return <div className="mx-auto max-w-[1320px] px-6 py-10 text-sv-small text-sv-danger">{error}</div>;
  if (!d) return <div className="mx-auto max-w-[1320px] px-6 py-10"><span className="sv-label sv-label--live">LOADING</span></div>;

  const { session: s, assessment: a, brief, decisions, notes } = d;
  const files = d.attachments ?? [];
  const briefContent = brief?.content as Record<string, unknown> | undefined;
  const p1 = briefContent?.what_you_came_with as Record<string, string | string[]> | undefined;
  const p2 = briefContent?.what_it_could_become as Record<string, string | null> | undefined;
  const dir = brief?.language === "ar" ? "rtl" : "ltr";
  const industry = (d.state.slots.industry as { value?: string } | undefined)?.value;

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8">
      {toast && <div className="fixed end-6 top-20 z-30 rounded-sv-sm border border-sv-green-line bg-sv-surface-2 px-4 py-2 text-sv-small text-sv-text">{toast}</div>}

      {/* Header: contact + verdict + primary actions */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="sv-label">{s.status === "submitted" && decisions.length === 0 ? "AWAITING MANUAL REVIEW" : s.status.replace("_", " ").toUpperCase()} · conversation {s.language.toUpperCase()} · {s.turn_count} turns · ${Number(s.token_usage?.cost_usd ?? 0).toFixed(2)}</p>
              {(s.flags?.test || s.flags?.no_contact || s.flags?.decision_demands) && (
                <div className="mt-2 flex flex-wrap gap-2 text-sv-label-sm">
                  {s.flags?.test && <span className="rounded-sv-pill border border-sv-danger/40 px-2 py-0.5 text-sv-danger">TEST DATA — not a real prospect</span>}
                  {s.flags?.no_contact && <span className="rounded-sv-pill border border-sv-danger/40 px-2 py-0.5 text-sv-danger">VISITOR ASKED NOT TO BE CONTACTED</span>}
                  {s.flags?.decision_demands ? <span className="rounded-sv-pill border border-sv-line px-2 py-0.5 text-sv-text-3">asked the AI to decide ×{s.flags.decision_demands} (declined)</span> : null}
                </div>
              )}
              <h1 className="mt-2 font-display text-sv-h1 text-sv-text" dir="auto"><bdi>{s.visitor_name}</bdi></h1>
              <p className="mt-1 text-sv-small text-sv-text-2" dir="auto">
                {s.company && <><bdi>{s.company}</bdi>{s.role ? ` · ${s.role}` : ""} · </>}
                {industry ?? "industry n/a"} · {s.country}
              </p>
            </div>
            {a ? (
              <div className="text-end">
                <span className={cn("rounded-sv-pill border px-3 py-1 text-sv-small", verdictTone(a.verdict))}>{VERDICT_LABEL[a.verdict] ?? a.verdict}</span>
                <p className="mt-2 font-mono text-sv-h2 tabular-nums text-sv-text">{Number(a.weighted_score).toFixed(2)}<span className="text-sv-small text-sv-text-3"> / 5</span></p>
                <p className="text-sv-label text-sv-text-3">AI triage · internal suggestion, not a decision · confidence {Number(a.confidence).toFixed(2)}</p>
                {a.manipulation_detected && <p className="mt-1 text-sv-label text-sv-danger">⚠ manipulation attempt</p>}
              </div>
            ) : (
              <p className="text-sv-small text-sv-text-3">AI triage: {s.assessment_status}</p>
            )}
          </div>
          <dl className="mt-5 grid gap-x-8 gap-y-2 text-sv-small sm:grid-cols-2">
            <Row k="Email"><a className="hover:text-sv-green" href={`mailto:${s.email}`}><bdi>{s.email}</bdi></a></Row>
            <Row k="Phone"><a className="hover:text-sv-green" href={`https://wa.me/${s.phone_e164.replace(/\D/g, "")}`} target="_blank" rel="noopener"><bdi>{s.phone_e164}</bdi></a> <span className="text-sv-text-3">(WhatsApp)</span></Row>
            <Row k="Started">{fmtDate(s.created_at)}</Row>
            <Row k="Submitted">{fmtDate(s.submitted_at)}</Row>
            <Row k="Consent">{s.consent_version} · {fmtDate(s.consent_at)}</Row>
            <Row k="Prompt">{s.prompt_version}{a ? ` · rubric ${a.rubric_version}` : ""}</Row>
          </dl>
          {a && (
            <ul className="mt-5 space-y-1.5 border-t border-sv-line pt-4 text-sv-body text-sv-text-2">
              {a.why_lines.map((w, i) => (
                <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sv-green" />{w}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3 rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
          <p className="sv-label">{decisions.length ? "DECISION RECORDED" : "AWAITING MANUAL REVIEW"} · nothing is sent until you preview and confirm</p>
          <div className="grid gap-2">
            <ActionBtn onClick={() => startDraft("book_call")} disabled={busy !== null} primary>Book a call</ActionBtn>
            <ActionBtn onClick={() => startDraft("request_quote")} disabled={busy !== null}>Request quote details</ActionBtn>
            <ActionBtn onClick={() => startDraft("decline")} disabled={busy !== null}>Polite decline</ActionBtn>
            <ActionBtn onClick={markHold} disabled={busy !== null}>Mark on hold</ActionBtn>
          </div>
          <div className="mt-2 grid gap-2 border-t border-sv-line pt-3">
            <ActionBtn onClick={() => openPacket("md")}>Export review packet (.md)</ActionBtn>
            <ActionBtn onClick={() => openPacket("html")}>Print packet / PDF</ActionBtn>
            <ActionBtn onClick={() => act("Re-assess", () => adminFetch(token, `/api/admin/lab/${id}/assess`, { method: "POST" }))} disabled={busy !== null || s.assessment_status === "running"}>
              {busy === "Re-assess" ? "Running…" : "Re-run assessment"}
            </ActionBtn>
            <ActionBtn
              onClick={() => {
                if (window.confirm("Permanently delete this session and everything attached to it?")) {
                  void act("Delete", () => adminFetch(token, `/api/admin/lab/${id}`, { method: "DELETE" })).then(() => window.location.assign("/supadmin/lab"));
                }
              }}
              danger
            >
              Delete session data
            </ActionBtn>
          </div>
        </div>
      </div>

      {/* Draft editor */}
      {draft && (
        <div className="mt-6 rounded-sv-md border border-sv-green-line bg-sv-surface-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="sv-label sv-label--live">{draft.action.replace("_", " ").toUpperCase()} · draft ({draft.source}) · edit before sending</p>
            <button onClick={() => setDraft(null)} className="text-sv-small text-sv-text-3 hover:text-sv-text">Discard</button>
          </div>
          <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} dir="auto" className="mt-3 w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-body text-sv-text" />
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} dir="auto" rows={12} className="mt-2 w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 font-ar text-sv-body leading-relaxed text-sv-text" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={draft.hint} onChange={(e) => setDraft({ ...draft, hint: e.target.value })} placeholder="Note for the redraft (e.g. mention Thursday, keep it shorter)…" className="min-w-64 flex-1 rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text" />
            <ActionBtn onClick={redraft} disabled={busy !== null}>{busy === "draft" ? "Drafting…" : "Redraft"}</ActionBtn>
            <ActionBtn onClick={previewSend} disabled={busy !== null || draft.subject.trim().length < 2 || draft.body.trim().length < 10} primary>{busy === "preview" ? "Rendering…" : "Preview exact email"}</ActionBtn>
          </div>
          {preview && (
            <div className="mt-4 rounded-sv-md border border-sv-line bg-sv-surface-1 p-4" data-testid="send-preview">
              <p className="sv-label">PREVIEW · to <bdi>{preview.to}</bdi> · subject: <span dir="auto">{preview.subject}</span></p>
              <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="mt-3 h-96 w-full rounded-sv-sm border border-sv-line bg-white" />
              {preview.test && <p className="mt-3 text-sv-small text-sv-danger">This session is marked as TEST DATA. Sending is almost certainly a mistake.</p>}
              {preview.noContact && <p className="mt-1 text-sv-small text-sv-danger">The visitor asked NOT to be contacted. Sending requires an explicit override.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionBtn onClick={() => confirmSend(false)} disabled={busy !== null || preview.noContact} primary>Confirm and send</ActionBtn>
                {preview.noContact && <ActionBtn onClick={() => confirmSend(true)} disabled={busy !== null} danger>Override no-contact and send</ActionBtn>}
                <ActionBtn onClick={() => setPreview(null)}>Back to editing</ActionBtn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex rounded-sv-sm border border-sv-line p-0.5">
          {(["brief", "score", "transcript", "state"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-sv-sm px-4 py-1.5 text-sv-small capitalize transition-colors", tab === t ? "bg-sv-surface-3 text-sv-text" : "text-sv-text-3 hover:text-sv-text")}>
              {t === "score" ? "Scorecard" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          {tab === "brief" && (
            brief && p1 && p2 ? (
              <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5 font-ar" dir={dir}>
                <p className="sv-label">BRIEF v{brief.version} · {brief.kind}{brief.source_version ? ` from v${brief.source_version}` : ""} · document {brief.language.toUpperCase()}{s.submitted_brief_version === brief.version ? " · SUBMITTED VERSION" : s.current_brief_version === brief.version ? " · current draft" : ""}</p>
                {d.briefVersions.length > 1 && (
                  <p className="mt-1 text-sv-label text-sv-text-3">History: {d.briefVersions.map((v) => `v${v.version} ${v.kind} ${v.language.toUpperCase()}${v.source_version ? ` (from v${v.source_version})` : ""}`).join(" · ")}</p>
                )}
                <h2 className="mt-2 font-display text-sv-h2 text-sv-text">{String(briefContent?.title ?? "")}</h2>
                <p className="mt-1 text-sv-body text-sv-text-2">{String(briefContent?.one_line ?? "")}</p>
                <h3 className="mt-6 text-sv-h3 text-sv-text">What you came with</h3>
                <Fields obj={p1} />
                <h3 className="mt-6 text-sv-h3 text-sv-text">What it could become</h3>
                <Fields obj={p2} />
                <h3 className="mt-6 text-sv-h3 text-sv-text">Commitment</h3>
                <Fields obj={{ what_you_bring: (briefContent?.what_you_bring as string[]) ?? [], what_you_expect: String(briefContent?.what_you_expect ?? ""), constraints: String(briefContent?.constraints ?? "") }} />
                {briefContent?.scope ? (
                  <>
                    <h3 className="mt-6 text-sv-h3 text-sv-text">Scope at a glance</h3>
                    <Fields obj={briefContent.scope as Record<string, string | string[]>} />
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-sv-small text-sv-text-3">No brief yet.</p>
            )
          )}

          {tab === "score" && (
            a ? (
              <div className="grid gap-4">
                <div className="overflow-x-auto rounded-sv-md border border-sv-line">
                  <table className="w-full text-sv-small">
                    <thead className="bg-sv-surface-1 text-sv-label text-sv-text-3"><tr><th className="px-3 py-2 text-start font-normal">Dimension</th><th className="px-3 py-2 text-end font-normal">Score</th><th className="px-3 py-2 text-start font-normal">Note & evidence</th></tr></thead>
                    <tbody>
                      {Object.entries(a.scores).map(([k, v]) => (
                        <tr key={k} className="border-t border-sv-line align-top">
                          <td className="px-3 py-2.5 text-sv-text">{DIMENSION_LABEL[k] ?? k}</td>
                          <td className="px-3 py-2.5 text-end font-mono tabular-nums"><span className={cn(v.score >= 4 ? "text-sv-green" : v.score <= 2 ? "text-sv-danger" : "text-sv-text")}>{v.score}</span></td>
                          <td className="px-3 py-2.5 text-sv-text-2">
                            <p>{v.note}</p>
                            {v.evidence.map((e, i) => <p key={i} className="mt-1 border-s-2 border-sv-line ps-2 font-ar text-sv-text-3" dir="auto">“{e}”</p>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
                  <p className="sv-label">RED FLAGS</p>
                  {a.red_flags.filter((f) => f.triggered).length === 0 ? <p className="mt-2 text-sv-small text-sv-text-3">None triggered.</p> : (
                    <ul className="mt-2 space-y-2 text-sv-small">
                      {a.red_flags.filter((f) => f.triggered).map((f) => <li key={f.id}><span className="text-sv-danger">{f.id.replace(/_/g, " ")}</span> — <span className="text-sv-text-2" dir="auto">{f.evidence}</span></li>)}
                    </ul>
                  )}
                </div>
                <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5 text-sv-small text-sv-text-2">
                  <p className="sv-label">ASSESSOR REASONING</p>
                  <p className="mt-2 whitespace-pre-wrap">{a.reasoning}</p>
                </div>
                {a.proposed_plan && (
                  <div className="rounded-sv-md border border-sv-green-line/50 bg-sv-surface-1 p-5 text-sv-small">
                    <p className="sv-label sv-label--live">AI&apos;S PROPOSED PLAN · internal</p>
                    <dl className="mt-3 grid gap-3">
                      <div><dt className="text-sv-text-3">What Stryvia could build</dt><dd className="text-sv-text">{a.proposed_plan.what_stryvia_could_build}</dd></div>
                      <div><dt className="text-sv-text-3">Rough scope</dt><dd className="text-sv-text">{a.proposed_plan.rough_scope}</dd></div>
                      <div><dt className="text-sv-text-3">Suggested deal shape</dt><dd className="text-sv-text">{a.proposed_plan.suggested_deal_shape}</dd></div>
                      {a.proposed_plan.open_questions.length > 0 && <div><dt className="text-sv-text-3">Open questions</dt><dd><ul className="list-disc ps-5 text-sv-text">{a.proposed_plan.open_questions.map((q, i) => <li key={i}>{q}</li>)}</ul></dd></div>}
                    </dl>
                  </div>
                )}
                {d.assessments.length > 1 && <p className="text-sv-label text-sv-text-3">{d.assessments.length} assessments on file; showing the latest ({fmtDate(a.created_at)}, {a.actor}).</p>}
              </div>
            ) : (
              <p className="text-sv-small text-sv-text-3">No assessment yet ({s.assessment_status}).</p>
            )
          )}

          {tab === "transcript" && (
            <div className="space-y-4">
              {d.messages.filter((m) => m.role !== "system").map((m) => (
                <div key={m.id} className={cn("max-w-[85%] rounded-sv-md border p-3 font-ar text-sv-small leading-relaxed", m.role === "user" ? "ms-auto border-sv-line bg-sv-surface-3" : "border-sv-line/60 bg-sv-surface-1")} dir="auto">
                  <p className="sv-label mb-1 text-sv-text-3">{m.role === "user" ? `VISITOR${m.input_mode === "voice" ? " · voice" : ""}` : "STRYVIA AI"} · {fmtDate(m.created_at)}{m.guardrail_hits ? " · ⚠ guardrail hit" : ""}</p>
                  <p className="whitespace-pre-wrap text-sv-text">{m.content}</p>
                  {m.input_mode === "voice" && m.transcript_raw && m.transcript_raw !== m.content && <p className="mt-2 text-sv-text-3">raw: {m.transcript_raw}</p>}
                </div>
              ))}
            </div>
          )}

          {tab === "state" && (
            <div className="grid gap-4">
              <div className="overflow-x-auto rounded-sv-md border border-sv-line">
                <table className="w-full text-sv-small">
                  <thead className="bg-sv-surface-1 text-sv-label text-sv-text-3"><tr><th className="px-3 py-2 text-start font-normal">Slot</th><th className="px-3 py-2 text-start font-normal">Confidence</th><th className="px-3 py-2 text-start font-normal">Value</th></tr></thead>
                  <tbody>
                    {Object.entries(d.state.slots).map(([k, v]) => {
                      if (k === "expansion_reactions") {
                        return Object.entries(v as Record<string, { reaction: string; quote: string } | null>).map(([step, e]) => e && (
                          <tr key={`${k}.${step}`} className="border-t border-sv-line"><td className="px-3 py-2 text-sv-text">ladder · {step}</td><td className="px-3 py-2">—</td><td className="px-3 py-2 font-ar text-sv-text-2" dir="auto">{e.reaction} — “{e.quote}”</td></tr>
                        ));
                      }
                      const e = v as { value: string; confidence: number };
                      return (
                        <tr key={k} className="border-t border-sv-line align-top">
                          <td className="px-3 py-2 text-sv-text">{k.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2"><span className="inline-block h-1.5 w-24 rounded-full bg-sv-surface-3 align-middle"><span className="block h-full rounded-full bg-sv-green" style={{ width: `${Math.round(e.confidence * 100)}%` }} /></span> <span className="font-mono text-sv-text-3">{e.confidence.toFixed(2)}</span></td>
                          <td className="px-3 py-2 font-ar text-sv-text-2" dir="auto">{e.value}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {d.state.industry_lens && (
                <pre className="overflow-x-auto rounded-sv-md border border-sv-line bg-sv-surface-1 p-4 text-sv-label text-sv-text-2 whitespace-pre-wrap">{JSON.stringify(d.state.industry_lens, null, 2)}</pre>
              )}
              {d.state.rolling_summary && <p className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-4 text-sv-small text-sv-text-2">{d.state.rolling_summary}</p>}
            </div>
          )}
        </div>

        {/* Side: decisions + notes */}
        <div className="grid gap-4 self-start">
          <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
            <p className="sv-label">DECISIONS</p>
            {decisions.length === 0 ? <p className="mt-2 text-sv-small text-sv-text-3">Awaiting decision.</p> : (
              <ul className="mt-2 space-y-3 text-sv-small">
                {decisions.map((dec) => (
                  <li key={dec.id} className="border-t border-sv-line pt-2">
                    <p className="text-sv-text">{DECISION_LABEL[dec.decision] ?? dec.decision} <span className="text-sv-text-3">· by {dec.decided_by} · {fmtDate(dec.decided_at)}</span></p>
                    {dec.outbound_email_subject && <p className="mt-1 text-sv-text-2" dir="auto">{dec.outbound_email_sent_at ? "Sent" : "Not sent"}: “{dec.outbound_email_subject}”</p>}
                    {dec.notes && <p className="mt-1 text-sv-text-3">{dec.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5" data-testid="admin-attachments">
            <p className="sv-label">FILES SENT BY THE VISITOR ({files.filter((f) => f.status === "stored").length})</p>
            {files.length === 0 ? (
              <p className="mt-2 text-sv-small text-sv-text-3">No files or voice recordings.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sv-small">
                {files.map((f) => (
                  <li key={f.id} className="border-t border-sv-line pt-2">
                    {f.url ? (
                      <a href={f.url} className="text-sv-text underline-offset-4 hover:underline" dir="auto" rel="noopener">{f.kind === "voice" ? "🎙 " : "📎 "}{f.file_name}</a>
                    ) : (
                      <span className="text-sv-text-3" dir="auto">{f.file_name} · upload not completed</span>
                    )}
                    <span className="text-sv-text-3"> · {humanSize(Number(f.size_bytes))} · {f.mime_type} · {fmtDate(f.created_at)}{f.message_id ? "" : " · not attached to a sent message"}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sv-label text-sv-text-3">Links expire after an hour; reload the page for fresh ones.</p>
          </div>
          <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5">
            <p className="sv-label">PRIVATE NOTES</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a note…" className="mt-2 w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-small text-sv-text" />
            <div className="mt-2 flex justify-end">
              <ActionBtn onClick={() => act("Note", () => adminFetch(token, `/api/admin/lab/${id}/notes`, { method: "POST", body: JSON.stringify({ body: note }) })).then(() => setNote(""))} disabled={busy !== null || note.trim().length === 0}>Save note</ActionBtn>
            </div>
            <ul className="mt-3 space-y-2 text-sv-small">
              {notes.map((n) => <li key={n.id} className="border-t border-sv-line pt-2 text-sv-text-2"><span className="text-sv-text-3">{n.author} · {fmtDate(n.created_at)}</span><br />{n.body}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-sv-text-3">{k}</dt>
      <dd className="text-sv-text-2">{children}</dd>
    </div>
  );
}

function Fields({ obj }: { obj: Record<string, string | string[] | null> }) {
  return (
    <dl className="mt-2 grid gap-3">
      {Object.entries(obj).filter(([, v]) => v !== null).map(([k, v]) => (
        <div key={k} className="border-t border-sv-line pt-2">
          <dt className="sv-label text-sv-text-3">{k.replace(/_/g, " ")}</dt>
          <dd className="mt-1 text-sv-body text-sv-text-2">{Array.isArray(v) ? (v.length ? <ol className="list-decimal ps-5">{v.map((x, i) => <li key={i}>{x}</li>)}</ol> : "—") : v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionBtn({ children, onClick, disabled, primary, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-10 rounded-sv-sm border px-3.5 text-sv-small transition-colors disabled:opacity-50",
        primary ? "border-sv-green bg-sv-green text-sv-on-accent hover:bg-sv-green-press" : danger ? "border-sv-danger/40 text-sv-danger hover:bg-sv-danger/10" : "border-sv-line-strong text-sv-text hover:border-sv-green-line hover:text-sv-green",
      )}
    >
      {children}
    </button>
  );
}
