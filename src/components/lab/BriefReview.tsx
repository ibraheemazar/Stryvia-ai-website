"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { FIELD_KEY, labFetch, textDir, type BriefChange, type BriefContent, type BriefVersionInfo, type BriefView } from "./lab-client";

// Brief review (brief §2.6). The document language (brief.language) drives
// labels, direction and the translate target — never the page locale or the
// conversation language. Edits are saved against the version they started
// from; translations and AI revisions come back as PROPOSALS shown next to a
// list of what changed, and nothing replaces the current version until the
// visitor accepts. Every request carries the version it is based on, so a
// stale result can never overwrite a newer edit.

const taCls =
  "w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-body text-sv-text focus:border-sv-green-line focus:outline-none";

type Proposal = { brief: BriefView; changes: BriefChange[]; kind: "translated" | "revised" | "generated"; warnings: string[] };
type Busy = null | "save" | "revise" | "translate" | "submit" | "accept" | "view";

export function BriefReview({
  sessionId,
  brief,
  versions,
  onBrief,
  onReload,
  onSubmitted,
}: {
  sessionId: string;
  brief: BriefView;
  versions: BriefVersionInfo[];
  onBrief: (b: BriefView, versions?: BriefVersionInfo[]) => void;
  onReload: () => Promise<void>;
  onSubmitted: (version: number, responseDays: number | null) => void;
}) {
  const t = useTranslations("lab.brief");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BriefContent>(brief.content);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [viewing, setViewing] = useState<BriefView | null>(null);

  useEffect(() => {
    if (!editing) setDraft(brief.content);
  }, [brief, editing]);

  const shown = viewing ?? proposal?.brief ?? brief;
  const docLang = shown.language;
  const dir = docLang === "ar" ? "rtl" : "ltr";
  const otherLang: "en" | "ar" = brief.language === "ar" ? "en" : "ar";
  const langName = (l: "en" | "ar") => (l === "ar" ? t("arabic") : t("english"));
  const pendingProposals = versions.filter((v) => v.status === "proposed");

  function explain(err: string | undefined, details?: { missingNumbers?: string[] }): string {
    switch (err) {
      case "stale":
        return t("errStale");
      case "facts_lost":
        return t("errFactsLost", { facts: (details?.missingNumbers ?? []).join(", ") || "—" });
      case "language_mismatch":
        return t("errLanguage");
      case "busy":
        return t("errBusy");
      case "rate_limited":
        return t("errRate");
      default:
        return err ?? "error";
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    const { status, data } = await labFetch<{ ok: boolean; brief?: BriefView; versions?: BriefVersionInfo[]; error?: string }>(`/api/lab/session/${sessionId}/brief`, {
      method: "PUT",
      body: JSON.stringify({ content: draft, baseVersion: brief.version }),
      timeoutMs: 30_000,
    });
    setBusy(null);
    if (data.ok && data.brief) {
      onBrief(data.brief, data.versions);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else if (status === 409 && data.error === "stale") {
      setError(t("errStale"));
      setEditing(false);
      await onReload();
    } else setError(explain(data.error));
  }

  async function propose(mode: "revise" | "translate") {
    setBusy(mode);
    setError(null);
    setViewing(null);
    const body = mode === "revise" ? { mode, instruction, baseVersion: brief.version } : { mode, language: otherLang, baseVersion: brief.version };
    try {
      const { status, data } = await labFetch<{ ok: boolean; proposal?: BriefView; changes?: BriefChange[]; warnings?: string[]; versions?: BriefVersionInfo[]; error?: string; details?: { missingNumbers?: string[] } }>(
        `/api/lab/session/${sessionId}/brief`,
        { method: "POST", body: JSON.stringify(body), timeoutMs: 125_000 },
      );
      if (data.ok && data.proposal) {
        setProposal({ brief: data.proposal, changes: data.changes ?? [], kind: mode === "translate" ? "translated" : "revised", warnings: data.warnings ?? [] });
        if (data.versions) onBrief(brief, data.versions);
        if (mode === "revise") setInstruction("");
      } else if (status === 409 && data.error === "stale") {
        setError(t("errStale"));
        await onReload();
      } else setError(explain(data.error, data.details));
    } catch {
      setError(t("errBusy"));
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    if (!proposal) return;
    setBusy("accept");
    setError(null);
    const { status, data } = await labFetch<{ ok: boolean; brief?: BriefView; versions?: BriefVersionInfo[]; error?: string }>(`/api/lab/session/${sessionId}/brief`, {
      method: "POST",
      body: JSON.stringify({ mode: "accept", version: proposal.brief.version }),
      timeoutMs: 30_000,
    });
    setBusy(null);
    if (data.ok && data.brief) {
      onBrief(data.brief, data.versions);
      setProposal(null);
    } else if (status === 409) {
      setError(t("errStale"));
      setProposal(null);
      await onReload();
    } else setError(explain(data.error));
  }

  async function view(version: number) {
    setBusy("view");
    setError(null);
    const { data } = await labFetch<{ ok: boolean; brief?: BriefView; versions?: BriefVersionInfo[] }>(`/api/lab/session/${sessionId}/brief?version=${version}`, { timeoutMs: 20_000 });
    setBusy(null);
    if (!data.ok || !data.brief) return;
    const info = versions.find((v) => v.version === version);
    if (info?.status === "proposed") setProposal({ brief: data.brief, changes: [], kind: info.kind === "translated" ? "translated" : info.kind === "revised" ? "revised" : "generated", warnings: [] });
    else setViewing(data.brief);
  }

  async function submit() {
    setBusy("submit");
    setError(null);
    const { status, data } = await labFetch<{ ok: boolean; submittedVersion?: number; responseDays?: number | null; error?: string }>(`/api/lab/session/${sessionId}/submit`, {
      method: "POST",
      body: JSON.stringify({ version: brief.version }),
      timeoutMs: 30_000,
    });
    setBusy(null);
    if (data.ok) onSubmitted(data.submittedVersion ?? brief.version, data.responseDays ?? null);
    else if (status === 409 && data.error === "stale") {
      setError(t("errStale"));
      await onReload();
    } else setError(explain(data.error));
  }

  const c = shown.content;
  const P1 = editing ? draft.what_you_came_with : c.what_you_came_with;
  const P2 = editing ? draft.what_it_could_become : c.what_it_could_become;
  const S = editing ? draft.scope : c.scope;
  const set1 = (k: keyof BriefContent["what_you_came_with"], v: string | string[]) => setDraft({ ...draft, what_you_came_with: { ...draft.what_you_came_with, [k]: v } });
  const set2 = (k: keyof BriefContent["what_it_could_become"], v: string | null) => setDraft({ ...draft, what_it_could_become: { ...draft.what_it_could_become, [k]: v } });
  const setScope = (k: keyof BriefContent["scope"], v: string[]) => setDraft({ ...draft, scope: { ...draft.scope, [k]: v } });
  const readOnly = Boolean(viewing || proposal);
  const canEdit = !readOnly && !editing && busy === null;
  const ladderEmpty = [P2.automate, P2.add_intelligence, P2.productize, P2.scale].every((v) => !v);

  function Field({ label, value, onChange, list, nullable }: { label: string; value: string | string[] | null; onChange?: (v: string | string[] | null) => void; list?: boolean; nullable?: boolean }) {
    if (value === null && !(editing && onChange)) return null;
    const text = Array.isArray(value) ? value.join("\n") : (value ?? "");
    return (
      <div className="border-t border-sv-line py-4">
        <p className="sv-label mb-2">{label}</p>
        {editing && onChange ? (
          <textarea
            dir={dir}
            className={taCls}
            rows={list ? 4 : 3}
            value={text}
            placeholder={nullable ? t("notExplored") : undefined}
            onChange={(e) => onChange(list ? e.target.value.split("\n").filter(Boolean) : nullable && !e.target.value.trim() ? null : e.target.value)}
          />
        ) : Array.isArray(value) ? (
          value.length ? (
            <ol className={cn("space-y-1.5 text-sv-body text-sv-text-2", list ? "list-decimal ps-5" : "ps-1")} dir={dir}>
              {value.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sv-small text-sv-text-3">—</p>
          )
        ) : (
          <p className="text-sv-body leading-relaxed text-sv-text-2" dir={textDir(value ?? "") === "auto" ? dir : textDir(value ?? "")}>{value}</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-8" data-testid="brief-review" data-doc-language={docLang}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="sv-label sv-label--live">{t("title")}</p>
          <h2 className="mt-3 font-display text-sv-h1 text-sv-text" dir={dir}>{c.title}</h2>
          <p className="mt-2 max-w-2xl text-sv-body-l text-sv-text-2" dir={dir}>{c.one_line}</p>
          <p className="mt-3 text-sv-small text-sv-text-3">{t("sub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sv-label text-sv-text-3" data-testid="brief-version">
          <span>{t("version", { n: shown.version })}</span>
          <span>· {langName(shown.language)}</span>
          <span>· {t(`kind.${shown.kind}`)}</span>
          {shown.visitorEdited && shown.kind !== "edited" && <span>· {t("edited")}</span>}
          {saved && <span className="text-sv-green">· {t("saved")}</span>}
        </div>
      </header>

      {viewing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sv-md border border-sv-line bg-sv-surface-2 px-4 py-3 text-sv-small text-sv-text-2" role="status">
          <span>{t("viewing", { n: viewing.version, language: langName(viewing.language) })}</span>
          <Button variant="ghost" onClick={() => setViewing(null)}>{t("backToCurrent")}</Button>
        </div>
      )}

      {proposal && (
        <section className="rounded-sv-lg border border-sv-green-line bg-sv-surface-2 p-5 sm:p-6" data-testid="brief-proposal" data-proposal-kind={proposal.kind}>
          <p className="sv-label sv-label--live">
            {proposal.kind === "translated" ? t("proposalTranslated", { language: langName(proposal.brief.language) }) : t("proposalRevised")}
          </p>
          <p className="mt-2 text-sv-small text-sv-text-2">{t("proposalNote")}</p>
          {proposal.kind === "revised" && (
            <div className="mt-4">
              <p className="sv-label mb-2">{t("changes")}</p>
              {proposal.changes.length === 0 ? (
                <p className="text-sv-small text-sv-text-3">{t("noChanges")}</p>
              ) : (
                <ul className="grid gap-3" data-testid="brief-changes">
                  {proposal.changes.map((ch) => (
                    <li key={ch.path} className="rounded-sv-sm border border-sv-line bg-sv-surface-1 p-3 text-sv-small" data-change-path={ch.path}>
                      <p className="sv-label mb-1.5">{t(`fields.${FIELD_KEY[ch.path] ?? "title"}`)}</p>
                      <p className="text-sv-text-3 line-through decoration-sv-line-strong" dir="auto">{ch.before || "—"}</p>
                      <p className="mt-1 text-sv-text" dir="auto">{ch.after || "—"}</p>
                    </li>
                  ))}
                </ul>
              )}
              {proposal.warnings.includes("facts_changed") && <p className="mt-3 text-sv-small text-sv-danger">{t("factsWarning")}</p>}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={accept} disabled={busy !== null} data-testid="brief-accept">
              {busy === "accept" ? "…" : proposal.kind === "translated" ? t("useVersion") : t("apply")}
            </Button>
            <Button variant="ghost" onClick={() => setProposal(null)} disabled={busy !== null}>{t("discard")}</Button>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-sv-lg border border-sv-line bg-sv-surface-1 p-5 sm:p-6" dir={dir}>
          <h3 className="font-display text-sv-h3 text-sv-text">{t("part1")}</h3>
          <div className="mt-2">
            <Field label={t("fields.problem")} value={P1.problem} onChange={(v) => set1("problem", v as string)} />
            <Field label={t("fields.who")} value={P1.who_is_affected} onChange={(v) => set1("who_is_affected", v as string)} />
            <Field label={t("fields.process")} value={P1.current_process} onChange={(v) => set1("current_process", v as string[])} list />
            <Field label={t("fields.frequency")} value={P1.frequency_and_volume} onChange={(v) => set1("frequency_and_volume", v as string)} />
            <Field label={t("fields.cost")} value={P1.cost_today} onChange={(v) => set1("cost_today", v as string)} />
            <Field label={t("fields.tried")} value={P1.tried_so_far} onChange={(v) => set1("tried_so_far", v as string)} />
            <Field label={t("fields.tools")} value={P1.tools} onChange={(v) => set1("tools", v as string)} />
            <Field label={t("fields.outcome")} value={P1.desired_outcome} onChange={(v) => set1("desired_outcome", v as string)} />
          </div>
        </section>
        <section className="rounded-sv-lg border border-sv-green-line/40 bg-sv-surface-1 p-5 sm:p-6" dir={dir}>
          <h3 className="font-display text-sv-h3 text-sv-text">{t("part2")}</h3>
          <p className="mt-1 text-sv-label text-sv-text-3">{t("part2Note")}</p>
          <p className="mt-4 text-sv-body text-sv-text-2">{P2.intro}</p>
          <div className="mt-2">
            <Field label={t("fields.automate")} value={P2.automate} onChange={(v) => set2("automate", v as string | null)} nullable />
            <Field label={t("fields.intelligence")} value={P2.add_intelligence} onChange={(v) => set2("add_intelligence", v as string | null)} nullable />
            <Field label={t("fields.productize")} value={P2.productize} onChange={(v) => set2("productize", v as string | null)} nullable />
            <Field label={t("fields.scale")} value={P2.scale} onChange={(v) => set2("scale", v as string | null)} nullable />
            {ladderEmpty && !editing && <p className="border-t border-sv-line py-4 text-sv-small text-sv-text-3">{t("notExplored")}</p>}
            <Field label={t("fields.ceiling")} value={P2.honest_ceiling_note} onChange={(v) => set2("honest_ceiling_note", v as string)} />
          </div>
        </section>
      </div>

      <section className="rounded-sv-lg border border-sv-line bg-sv-surface-1 p-5 sm:p-6" dir={dir}>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-8">
          <Field label={t("fields.bring")} value={editing ? draft.what_you_bring : c.what_you_bring} onChange={(v) => setDraft({ ...draft, what_you_bring: v as string[] })} list />
          <Field label={t("fields.expect")} value={editing ? draft.what_you_expect : c.what_you_expect} onChange={(v) => setDraft({ ...draft, what_you_expect: v as string })} />
          <Field label={t("fields.constraints")} value={editing ? draft.constraints : c.constraints} onChange={(v) => setDraft({ ...draft, constraints: v as string })} />
          <Field label={t("fields.next")} value={c.next_step_note} />
        </div>
      </section>

      <section className="rounded-sv-lg border border-sv-line bg-sv-surface-1 p-5 sm:p-6" dir={dir} data-testid="brief-scope">
        <h3 className="font-display text-sv-h3 text-sv-text">{t("scope")}</h3>
        {editing && <p className="mt-1 text-sv-label text-sv-text-3">{t("scopeNote")}</p>}
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-8">
          <Field label={t("fields.confirmed")} value={S.confirmed} onChange={(v) => setScope("confirmed", v as string[])} list />
          <Field label={t("fields.excluded")} value={S.excluded} onChange={(v) => setScope("excluded", v as string[])} list />
          <Field label={t("fields.assumptions")} value={S.assumptions} onChange={(v) => setScope("assumptions", v as string[])} list />
          <Field label={t("fields.openQuestions")} value={S.open_questions} onChange={(v) => setScope("open_questions", v as string[])} list />
        </div>
      </section>

      <div className="grid gap-4 rounded-sv-lg border border-sv-line bg-sv-surface-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          {editing ? (
            <>
              <Button variant="primary" onClick={save} disabled={busy !== null} data-testid="brief-save">{busy === "save" ? "…" : t("saveEdits")}</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setDraft(brief.content); }}>{t("cancel")}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => { setViewing(null); setProposal(null); setEditing(true); }} disabled={!canEdit && !(readOnly && busy === null)} data-testid="brief-edit">{t("edit")}</Button>
          )}
          <Button variant="ghost" onClick={() => propose("translate")} disabled={busy !== null || editing} data-testid="brief-translate">
            {busy === "translate" ? t("translating") : t("translate", { language: langName(otherLang) })}
          </Button>
        </div>
        <p className="text-sv-label text-sv-text-3">{t("langLocked", { language: langName(brief.language) })}</p>
        <label className="grid gap-1.5 text-sv-small text-sv-text-2">
          <span>{t("reviseLabel")}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input dir="auto" className={cn(taCls, "min-h-11")} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t("revisePlaceholder")} disabled={busy !== null || editing} data-testid="brief-instruction" />
            <Button variant="secondary" onClick={() => propose("revise")} disabled={busy !== null || editing || instruction.trim().length < 2} data-testid="brief-revise">
              {busy === "revise" ? t("revising") : t("revise")}
            </Button>
          </div>
        </label>
        {error && <p role="alert" className="text-sv-small text-sv-danger">{error}</p>}

        {versions.length > 1 && (
          <div className="border-t border-sv-line pt-4">
            <p className="sv-label mb-2">{t("history")}</p>
            <ul className="flex flex-wrap gap-2" data-testid="brief-versions">
              {versions.map((v) => (
                <li key={v.version}>
                  <button
                    type="button"
                    onClick={() => (v.version === brief.version ? (setViewing(null), setProposal(null)) : view(v.version))}
                    disabled={busy !== null || editing}
                    className={cn(
                      "min-h-9 rounded-sv-pill border px-3 text-sv-label transition-colors",
                      v.status === "current" ? "border-sv-green-line text-sv-green" : v.status === "proposed" ? "border-sv-line-strong text-sv-text" : "border-sv-line text-sv-text-3",
                    )}
                    data-version={v.version}
                    data-status={v.status}
                  >
                    v{v.version} · {langName(v.language)} · {t(`kind.${v.kind}`)}
                    {v.sourceVersion ? ` (${t("from", { n: v.sourceVersion })})` : ""} · {t(`status.${v.status}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sv-line pt-4">
          <p className="text-sv-small text-sv-text-3">{t("submitNote")}</p>
          <Button variant="primary" onClick={submit} disabled={busy !== null || editing || readOnly || pendingProposals.length > 0} arrow data-testid="brief-submit">
            {busy === "submit" ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
