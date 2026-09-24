import "server-only";
import type { LabLanguage } from "@/config/lab.config";
import { getLabAi } from "./ai";
import { labEvent } from "./events";
import { wrapUntrusted } from "./guardrails";
import { BRIEF_FROZEN, buildBriefUser } from "./prompts/brief";
import { lensText } from "./prompts/interviewer";
import { renderBriefHtml } from "./render";
import { BriefSchema, type Brief } from "./schemas";
import { describeState } from "./slots";
import { getLatestBrief, getState, listMessages, saveBrief, type LabBriefRow, type LabSessionRow } from "./store";

// Brief generation and revision (brief §4.4, §2.6).

export function transcriptText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => (m.role === "user" ? wrapUntrusted(m.content, "visitor") : `STRYVIA AI: ${m.content}`))
    .join("\n\n");
}

export async function generateBrief(
  session: LabSessionRow,
  opts: { language?: LabLanguage; revision?: { instruction: string } | null; actor?: "visitor" | "system" | "admin" } = {},
): Promise<LabBriefRow> {
  const language = opts.language ?? (session.language as LabLanguage);
  const [state, messages, previous] = await Promise.all([
    getState(session.id),
    listMessages(session.id),
    opts.revision ? getLatestBrief(session.id) : Promise.resolve(null),
  ]);

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
          revision:
            opts.revision && previous
              ? { previous: JSON.stringify(previous.content).slice(0, 20_000), instruction: opts.revision.instruction.slice(0, 1500) }
              : null,
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
    rendered_html: renderBriefHtml(brief, { language, visitorName: session.visitor_name }),
    visitor_edited: false,
  });
  await labEvent(opts.revision ? "brief.revised" : "brief.generated", "info", {
    sessionId: session.id,
    payload: { language, count: row.version },
  });
  return row;
}

/** Save a visitor-edited brief as a new version; HTML is always re-rendered server-side. */
export async function saveEditedBrief(session: LabSessionRow, content: unknown): Promise<LabBriefRow> {
  const brief: Brief = BriefSchema.parse(content);
  const latest = await getLatestBrief(session.id);
  const language = (latest?.language ?? session.language) as LabLanguage;
  const row = await saveBrief(session.id, {
    language,
    content: brief,
    rendered_html: renderBriefHtml(brief, { language, visitorName: session.visitor_name }),
    visitor_edited: true,
  });
  await labEvent("brief.edited", "info", { sessionId: session.id, payload: { count: row.version } });
  return row;
}
