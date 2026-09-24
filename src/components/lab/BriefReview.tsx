"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { labFetch, textDir, type BriefContent, type BriefView } from "./lab-client";

// Brief review (brief §2.6): two labelled parts; inline edit; ask the AI to
// revise; then submit. Edits post JSON only — HTML is rendered server-side.

const taCls =
  "w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 py-2 text-sv-body text-sv-text focus:border-sv-green-line focus:outline-none";

export function BriefReview({
  sessionId,
  brief,
  onBrief,
  onSubmitted,
}: {
  sessionId: string;
  brief: BriefView;
  onBrief: (b: BriefView) => void;
  onSubmitted: (responseDays: number) => void;
}) {
  const t = useTranslations("lab.brief");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BriefContent>(brief.content);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<null | "save" | "revise" | "translate" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const c = brief.content;
  const dir = brief.language === "ar" ? "rtl" : "ltr";
  const otherLang = brief.language === "ar" ? "en" : "ar";

  async function save() {
    setBusy("save");
    setError(null);
    const { data } = await labFetch<{ ok: boolean; brief?: BriefView; error?: string }>(`/api/lab/session/${sessionId}/brief`, {
      method: "PUT",
      body: JSON.stringify({ content: draft }),
    });
    setBusy(null);
    if (data.ok && data.brief) {
      onBrief(data.brief);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else setError(data.error ?? "error");
  }

  async function revise(mode: "revise" | "translate") {
    setBusy(mode);
    setError(null);
    const body = mode === "revise" ? { mode, instruction } : { mode, language: otherLang };
    const { data } = await labFetch<{ ok: boolean; brief?: BriefView; error?: string }>(`/api/lab/session/${sessionId}/brief`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (data.ok && data.brief) {
      onBrief(data.brief);
      setDraft(data.brief.content);
      setInstruction("");
    } else setError(data.error ?? "error");
  }

  async function submit() {
    setBusy("submit");
    setError(null);
    const { data } = await labFetch<{ ok: boolean; responseDays?: number; error?: string }>(`/api/lab/session/${sessionId}/submit`, { method: "POST" });
    setBusy(null);
    if (data.ok) onSubmitted(data.responseDays ?? 7);
    else setError(data.error ?? "error");
  }

  const P1 = draft.what_you_came_with;
  const P2 = draft.what_it_could_become;
  const set1 = (k: keyof BriefContent["what_you_came_with"], v: string | string[]) => setDraft({ ...draft, what_you_came_with: { ...draft.what_you_came_with, [k]: v } });
  const set2 = (k: keyof BriefContent["what_it_could_become"], v: string) => setDraft({ ...draft, what_it_could_become: { ...draft.what_it_could_become, [k]: v } });

  function Field({ label, value, onChange, list }: { label: string; value: string | string[]; onChange?: (v: string | string[]) => void; list?: boolean }) {
    const text = Array.isArray(value) ? value.join("\n") : value;
    return (
      <div className="border-t border-sv-line py-4">
        <p className="sv-label mb-2">{label}</p>
        {editing && onChange ? (
          <textarea dir={dir} className={taCls} rows={list ? 4 : 3} value={text} onChange={(e) => onChange(list ? e.target.value.split("\n").filter(Boolean) : e.target.value)} />
        ) : Array.isArray(value) ? (
          <ol className={cn("space-y-1.5 text-sv-body text-sv-text-2", list ? "list-decimal ps-5" : "ps-1")} dir={dir}>
            {value.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sv-body leading-relaxed text-sv-text-2" dir={textDir(value) === "auto" ? dir : textDir(value)}>{value}</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-8" data-testid="brief-review">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="sv-label sv-label--live">{t("title")}</p>
          <h2 className="mt-3 font-display text-sv-h1 text-sv-text" dir={dir}>{c.title}</h2>
          <p className="mt-2 max-w-2xl text-sv-body-l text-sv-text-2" dir={dir}>{c.one_line}</p>
          <p className="mt-3 text-sv-small text-sv-text-3">{t("sub")}</p>
        </div>
        <div className="flex items-center gap-3 text-sv-label text-sv-text-3">
          <span>{t("version", { n: brief.version })}</span>
          {brief.visitorEdited && <span>· {t("edited")}</span>}
          {saved && <span className="text-sv-green">· {t("saved")}</span>}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-sv-lg border border-sv-line bg-sv-surface-1 p-5 sm:p-6">
          <h3 className="font-display text-sv-h3 text-sv-text">{t("part1")}</h3>
          <div className="mt-2">
            <Field label={t("fields.problem")} value={P1.problem} onChange={(v) => set1("problem", v)} />
            <Field label={t("fields.who")} value={P1.who_is_affected} onChange={(v) => set1("who_is_affected", v)} />
            <Field label={t("fields.process")} value={P1.current_process} onChange={(v) => set1("current_process", v)} list />
            <Field label={t("fields.frequency")} value={P1.frequency_and_volume} onChange={(v) => set1("frequency_and_volume", v)} />
            <Field label={t("fields.cost")} value={P1.cost_today} onChange={(v) => set1("cost_today", v)} />
            <Field label={t("fields.tried")} value={P1.tried_so_far} onChange={(v) => set1("tried_so_far", v)} />
            <Field label={t("fields.tools")} value={P1.tools} onChange={(v) => set1("tools", v)} />
            <Field label={t("fields.outcome")} value={P1.desired_outcome} onChange={(v) => set1("desired_outcome", v)} />
          </div>
        </section>
        <section className="rounded-sv-lg border border-sv-green-line/40 bg-sv-surface-1 p-5 sm:p-6">
          <h3 className="font-display text-sv-h3 text-sv-text">{t("part2")}</h3>
          <p className="mt-1 text-sv-label text-sv-text-3">{t("part2Note")}</p>
          <p className="mt-4 text-sv-body text-sv-text-2" dir={dir}>{P2.intro}</p>
          <div className="mt-2">
            <Field label={t("fields.automate")} value={P2.automate} onChange={(v) => set2("automate", v as string)} />
            <Field label={t("fields.intelligence")} value={P2.add_intelligence} onChange={(v) => set2("add_intelligence", v as string)} />
            <Field label={t("fields.productize")} value={P2.productize} onChange={(v) => set2("productize", v as string)} />
            <Field label={t("fields.scale")} value={P2.scale} onChange={(v) => set2("scale", v as string)} />
            <Field label={t("fields.ceiling")} value={P2.honest_ceiling_note} onChange={(v) => set2("honest_ceiling_note", v as string)} />
          </div>
        </section>
      </div>

      <section className="rounded-sv-lg border border-sv-line bg-sv-surface-1 p-5 sm:p-6">
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-8">
          <Field label={t("fields.bring")} value={draft.what_you_bring} onChange={(v) => setDraft({ ...draft, what_you_bring: v as string[] })} list />
          <Field label={t("fields.expect")} value={draft.what_you_expect} onChange={(v) => setDraft({ ...draft, what_you_expect: v as string })} />
          <Field label={t("fields.constraints")} value={draft.constraints} onChange={(v) => setDraft({ ...draft, constraints: v as string })} />
          <Field label={t("fields.next")} value={draft.next_step_note} />
        </div>
      </section>

      <div className="grid gap-4 rounded-sv-lg border border-sv-line bg-sv-surface-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          {editing ? (
            <>
              <Button variant="primary" onClick={save} disabled={busy !== null}>{busy === "save" ? "…" : t("saveEdits")}</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setDraft(brief.content); }}>{t("cancel")}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy !== null}>{t("edit")}</Button>
          )}
          <Button variant="ghost" onClick={() => revise("translate")} disabled={busy !== null}>
            {busy === "translate" ? "…" : t("translate", { language: otherLang === "ar" ? t("arabic") : t("english") })}
          </Button>
        </div>
        <label className="grid gap-1.5 text-sv-small text-sv-text-2">
          <span>{t("reviseLabel")}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input dir="auto" className={cn(taCls, "min-h-11")} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t("revisePlaceholder")} disabled={busy !== null} />
            <Button variant="secondary" onClick={() => revise("revise")} disabled={busy !== null || instruction.trim().length < 2}>
              {busy === "revise" ? t("revising") : t("revise")}
            </Button>
          </div>
        </label>
        {error && <p role="alert" className="text-sv-small text-sv-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sv-line pt-4">
          <p className="text-sv-small text-sv-text-3">{t("submitNote")}</p>
          <Button variant="primary" onClick={submit} disabled={busy !== null || editing} arrow data-testid="brief-submit">
            {busy === "submit" ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
