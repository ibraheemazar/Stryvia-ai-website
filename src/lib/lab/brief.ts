import "server-only";
import type { LabLanguage } from "@/config/lab.config";
import { getLabAi } from "./ai";
import { checkFactPreservation, matchesLanguage } from "./brief-check";
import { diffBrief, type BriefChange } from "./brief-diff";
import { labEvent } from "./events";
import { wrapUntrusted } from "./guardrails";
import { BRIEF_FROZEN, buildBriefUser } from "./prompts/brief";
import { REVISE_FROZEN, TRANSLATE_FROZEN, buildReviseUser, buildTranslateUser } from "./prompts/brief-ops";
import { lensText } from "./prompts/interviewer";
import { renderBriefHtml } from "./render";
import { BriefSchema, normalizeBrief, type Brief } from "./schemas";
import { describeState } from "./slots";
import {
  getCurrentBrief,
  getState,
  listMessages,
  saveBrief,
  setCurrentBriefVersion,
  type LabBriefRow,
  type LabSessionRow,
} from "./store";

// Brief generation and the operations on saved versions (brief §4.4, §2.6).
//
// Version model:
//   - `generateBrief` writes version 1 from the conversation and makes it current.
//   - `saveEditedBrief` writes the visitor's edit as a new version and makes it current.
//   - `translateBrief` / `reviseBrief` read ONE saved version (never the
//     conversation), write the result as a PROPOSAL (not current) and return
//     the field-level changes so the visitor can review before accepting.
//   - `acceptBriefVersion` moves the current pointer, only if the proposal was
//     made from what is still current — a stale result can never overwrite a
//     newer edit.

export class BriefConflictError extends Error {
  constructor(public reason: "stale" | "not_proposal" | "not_found") {
    super(`brief conflict: ${reason}`);
    this.name = "BriefConflictError";
  }
}

/** The model's output failed a deterministic check; nothing was saved. */
export class BriefUnverifiedError extends Error {
  constructor(
    public reason: "facts_lost" | "language_mismatch",
    public details: { missingNumbers?: string[]; lostCurrency?: boolean; lostPercent?: boolean },
  ) {
    super(`brief unverified: ${reason}`);
    this.name = "BriefUnverifiedError";
  }
}

function factFeedback(r: ReturnType<typeof checkFactPreservation>): string {
  const parts: string[] = [];
  if (r.missingNumbers.length) parts.push(`these numbers must appear exactly: ${r.missingNumbers.join(", ")}`);
  if (r.lostCurrency) parts.push("the currency mention must be kept");
  if (r.lostPercent) parts.push("the percentage must be kept");
  return parts.join("; ");
}

export function transcriptText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => (m.role === "user" ? wrapUntrusted(m.content, "visitor") : `STRYVIA AI: ${m.content}`))
    .join("\n\n");
}

function render(brief: Brief, language: LabLanguage, session: LabSessionRow): string {
  // Workflow flags are rendered from session metadata, never from prose, so a
  // translation or revision cannot drop them.
  return renderBriefHtml(brief, { language, visitorName: session.visitor_name, flags: session.flags ?? {} });
}

/** First generation from the conversation. Becomes the current version. */
export async function generateBrief(
  session: LabSessionRow,
  opts: { language?: LabLanguage; actor?: "visitor" | "system" | "admin"; asProposalOf?: number | null } = {},
): Promise<LabBriefRow> {
  const language = opts.language ?? (session.language as LabLanguage);
  const [state, messages] = await Promise.all([getState(session.id), listMessages(session.id)]);

  const { value } = await getLabAi().structured({
    role: "brief",
    sessionId: session.id,
    actor: opts.actor ?? "visitor",
    frozenSystem: BRIEF_FROZEN,
    messages: [
      {
        role: "user",
        content: buildBriefUser({
          language,
          visitorName: session.visitor_name,
          stateText: describeState(state.slots),
          lensText: state.industry_lens ? lensText(state.industry_lens) : null,
          transcriptText: transcriptText(messages).slice(0, 60_000),
        }),
      },
    ],
    schema: BriefSchema,
    timeoutMs: 110_000,
  });

  const brief = BriefSchema.parse(value);
  const row = await saveBrief(session.id, {
    language,
    content: brief,
    rendered_html: render(brief, language, session),
    visitor_edited: false,
    kind: "generated",
    source_version: opts.asProposalOf ?? null,
  });
  if (opts.asProposalOf == null) await setCurrentBriefVersion(session.id, row.version, session.current_brief_version);
  await labEvent("brief.generated", "info", { sessionId: session.id, payload: { language, count: row.version } });
  return row;
}

/**
 * Save a visitor edit as a new version and make it current. `baseVersion` must
 * be the version the visitor was editing; otherwise their edit would silently
 * bury something newer.
 */
export async function saveEditedBrief(session: LabSessionRow, content: unknown, baseVersion: number): Promise<LabBriefRow> {
  const current = await getCurrentBrief(session);
  if (!current) throw new BriefConflictError("not_found");
  if (current.version !== baseVersion) throw new BriefConflictError("stale");
  const brief: Brief = BriefSchema.parse(content);
  const language = current.language as LabLanguage;
  const row = await saveBrief(session.id, {
    language,
    content: brief,
    rendered_html: render(brief, language, session),
    visitor_edited: true,
    kind: "edited",
    source_version: current.version,
  });
  const moved = await setCurrentBriefVersion(session.id, row.version, current.version);
  if (!moved) throw new BriefConflictError("stale");
  await labEvent("brief.edited", "info", { sessionId: session.id, payload: { count: row.version } });
  return row;
}

export type BriefProposal = { row: LabBriefRow; changes: BriefChange[]; warnings?: string[] };

/**
 * Translate ONE saved version into the other language. Reads nothing but that
 * version, so manual corrections travel with it. Saved as a proposal.
 */
export async function translateBrief(session: LabSessionRow, base: LabBriefRow, to: LabLanguage): Promise<BriefProposal> {
  const source = normalizeBrief(base.content);
  const from = base.language as LabLanguage;
  let translated: Brief | null = null;
  let feedback = "";
  let lastCheck: ReturnType<typeof checkFactPreservation> | null = null;
  for (let attempt = 1; attempt <= 2 && !translated; attempt += 1) {
    const { value } = await getLabAi().structured({
      role: "translate",
      sessionId: session.id,
      actor: "visitor",
      frozenSystem: TRANSLATE_FROZEN,
      messages: [{ role: "user", content: buildTranslateUser({ from, to, briefJson: JSON.stringify(source) }) + (feedback ? `\n\nPREVIOUS ATTEMPT WAS REJECTED — ${feedback}.` : "") }],
      schema: BriefSchema,
      timeoutMs: 110_000,
    });
    const candidate = BriefSchema.parse(value);
    const check = checkFactPreservation(source, candidate);
    lastCheck = check;
    if (!matchesLanguage(candidate, to)) {
      feedback = `the whole brief must be written in ${to === "ar" ? "Arabic" : "English"}`;
      await labEvent("brief.translation_rejected", "warn", { sessionId: session.id, payload: { code: "language_mismatch", language: to, count: attempt } });
      continue;
    }
    if (!check.ok) {
      feedback = factFeedback(check);
      await labEvent("brief.translation_rejected", "warn", { sessionId: session.id, payload: { code: "facts_lost", language: to, count: attempt, hits: check.missingNumbers.length } });
      continue;
    }
    translated = candidate;
  }
  if (!translated) {
    if (lastCheck && !lastCheck.ok) throw new BriefUnverifiedError("facts_lost", { missingNumbers: lastCheck.missingNumbers, lostCurrency: lastCheck.lostCurrency, lostPercent: lastCheck.lostPercent });
    throw new BriefUnverifiedError("language_mismatch", {});
  }
  const row = await saveBrief(session.id, {
    language: to,
    content: translated,
    rendered_html: render(translated, to, session),
    visitor_edited: false,
    kind: "translated",
    source_version: base.version,
  });
  await labEvent("brief.translated", "info", { sessionId: session.id, payload: { language: to, count: row.version } });
  return { row, changes: diffBrief(source, translated) };
}

/**
 * Apply a revision request to ONE saved version, in its own language, touching
 * only what the request names. Saved as a proposal with the list of changed
 * fields so the visitor sees exactly what moved before accepting.
 */
export async function reviseBrief(session: LabSessionRow, base: LabBriefRow, instruction: string): Promise<BriefProposal> {
  const source = normalizeBrief(base.content);
  const language = base.language as LabLanguage;
  let revised: Brief | null = null;
  let feedback = "";
  for (let attempt = 1; attempt <= 2 && !revised; attempt += 1) {
    const { value } = await getLabAi().structured({
      role: "revise",
      sessionId: session.id,
      actor: "visitor",
      frozenSystem: REVISE_FROZEN,
      messages: [{ role: "user", content: buildReviseUser({ language, briefJson: JSON.stringify(source), instruction: instruction.slice(0, 1500) }) + (feedback ? `\n\nPREVIOUS ATTEMPT WAS REJECTED — ${feedback}.` : "") }],
      schema: BriefSchema,
      timeoutMs: 110_000,
    });
    const candidate = BriefSchema.parse(value);
    // A revision must stay in the brief's language whatever the request says.
    if (!matchesLanguage(candidate, language)) {
      feedback = `keep the whole brief in ${language === "ar" ? "Arabic" : "English"}`;
      await labEvent("brief.revision_rejected", "warn", { sessionId: session.id, payload: { code: "language_mismatch", language, count: attempt } });
      continue;
    }
    revised = candidate;
  }
  if (!revised) throw new BriefUnverifiedError("language_mismatch", {});
  const changes = diffBrief(source, revised);
  // Numbers the revision dropped are reported to the visitor with the diff;
  // they decide. (A request may legitimately remove a figure.)
  const preservation = checkFactPreservation(source, revised);
  const row = await saveBrief(session.id, {
    language,
    content: revised,
    rendered_html: render(revised, language, session),
    visitor_edited: false,
    kind: "revised",
    source_version: base.version,
  });
  await labEvent("brief.revised", "info", {
    sessionId: session.id,
    payload: { language, count: row.version, from_version: base.version, hits: changes.length },
  });
  return { row, changes, warnings: preservation.ok ? [] : ["facts_changed"] };
}

/** Make a proposal the current version, if it was made from what is still current. */
export async function acceptBriefVersion(session: LabSessionRow, proposal: LabBriefRow): Promise<LabBriefRow> {
  const current = await getCurrentBrief(session);
  if (!current) throw new BriefConflictError("not_found");
  if (proposal.kind !== "translated" && proposal.kind !== "revised" && proposal.kind !== "generated") throw new BriefConflictError("not_proposal");
  if (proposal.source_version !== current.version) throw new BriefConflictError("stale");
  const moved = await setCurrentBriefVersion(session.id, proposal.version, current.version);
  if (!moved) throw new BriefConflictError("stale");
  await labEvent("brief.accepted", "info", {
    sessionId: session.id,
    payload: { count: proposal.version, language: proposal.language, kind: proposal.kind },
  });
  return proposal;
}
