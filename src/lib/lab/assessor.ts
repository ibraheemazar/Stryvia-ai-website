import "server-only";
import {
  RED_FLAGS,
  RUBRIC_DIMENSIONS,
  RUBRIC_VERSION,
  clampScore,
  scoreToVerdict,
  type DimensionScores,
  type RedFlagId,
} from "@/config/lab-rubric.config";
import { getServiceSupabase } from "@/lib/supabase";
import { getLabAi } from "./ai";
import { transcriptText } from "./brief";
import { getLabSettings } from "./env";
import { labEvent } from "./events";
import { looksLikeInjection } from "./guardrails";
import { ASSESSOR_FROZEN, buildAssessorUser } from "./prompts/assessor";
import { lensText } from "./prompts/interviewer";
import { PROMPT_VERSION } from "./prompts/version";
import { AssessmentSchema, type Assessment } from "./schemas";
import { describeState } from "./slots";
import { getLatestBrief, getState, listMessages, updateSession, type LabSessionRow } from "./store";

// Private assessment (brief §4.5, §5). Runs on submit and from admin. The
// verdict is recomputed in code from the scores; the model's own verdict is
// stored alongside for comparison.

export type LabAssessmentRow = {
  id: string;
  session_id: string;
  rubric_version: string;
  prompt_version: string;
  model: string;
  scores: Assessment["scores"];
  red_flags: Assessment["red_flags"];
  verdict: "productize" | "paid_build" | "priority_call" | "refer_or_pass";
  model_verdict: string | null;
  weighted_score: number;
  confidence: number;
  reasoning: string;
  why_lines: string[];
  proposed_plan: Assessment["proposed_plan"] | null;
  manipulation_detected: boolean;
  actor: "system" | "admin";
  created_at: string;
};

function db() {
  const s = getServiceSupabase();
  if (!s) throw new Error("Supabase service role is not configured.");
  return s;
}

export async function getLatestAssessment(sessionId: string): Promise<LabAssessmentRow | null> {
  const { data } = await db()
    .from("lab_assessments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LabAssessmentRow | null) ?? null;
}

export async function runAssessment(session: LabSessionRow, actor: "system" | "admin" = "system"): Promise<LabAssessmentRow> {
  await updateSession(session.id, { assessment_status: "running" });
  try {
    const [state, messages, brief] = await Promise.all([getState(session.id), listMessages(session.id), getLatestBrief(session.id)]);
    const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content);
    const injectionFlagged = userTexts.some(looksLikeInjection);
    const guardrailHits = messages.filter((m) => m.role === "assistant" && m.guardrail_hits).length;

    const { value } = await getLabAi().structured({
      role: "assess",
      sessionId: session.id,
      actor,
      frozenSystem: ASSESSOR_FROZEN,
      messages: [
        {
          role: "user",
          content: buildAssessorUser({
            visitor: {
              name: session.visitor_name,
              country: session.country,
              company: session.company,
              role: session.role,
              language: session.language,
            },
            stateText: describeState(state.slots),
            lensText: state.industry_lens ? lensText(state.industry_lens) : null,
            briefJson: brief ? JSON.stringify(brief.content).slice(0, 30_000) : "(no brief generated)",
            transcriptText: transcriptText(messages).slice(0, 80_000),
            injectionFlagged,
            guardrailHits,
          }),
        },
      ],
      schema: AssessmentSchema,
      timeoutMs: 110_000,
    });

    const scores: DimensionScores = Object.fromEntries(
      RUBRIC_DIMENSIONS.map((d) => [d.id, clampScore(value.scores[d.id].score)]),
    ) as DimensionScores;
    const triggered = value.red_flags.filter((f) => f.triggered).map((f) => f.id as RedFlagId);
    const { verdict, weighted, hardFlag } = scoreToVerdict(scores, triggered);
    const manipulation = value.manipulation_detected || injectionFlagged;

    const row = {
      session_id: session.id,
      rubric_version: RUBRIC_VERSION,
      prompt_version: PROMPT_VERSION,
      model: getLabSettings().models.assess,
      scores: value.scores,
      red_flags: value.red_flags,
      verdict,
      model_verdict: value.model_verdict,
      weighted_score: weighted,
      confidence: Math.min(1, Math.max(0, value.confidence)),
      reasoning: value.reasoning,
      why_lines: value.why_lines.slice(0, 5),
      proposed_plan: value.proposed_plan,
      manipulation_detected: manipulation,
      actor,
    };
    const { data, error } = await db().from("lab_assessments").insert(row).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "assessment insert failed");
    await updateSession(session.id, { assessment_status: "done", rubric_version: RUBRIC_VERSION });
    await labEvent("assessment.done", "info", {
      sessionId: session.id,
      payload: { verdict, weighted_score: weighted, actor, hits: triggered.length, ok: !hardFlag },
    });
    return data as LabAssessmentRow;
  } catch (err) {
    await updateSession(session.id, { assessment_status: "failed" });
    await labEvent("assessment.failed", "error", {
      sessionId: session.id,
      payload: { error: err instanceof Error ? err.message : String(err), actor },
    });
    throw err;
  }
}

export function redFlagLabels(flags: Assessment["red_flags"]): string[] {
  return flags.filter((f) => f.triggered).map((f) => RED_FLAGS.find((r) => r.id === f.id)?.label ?? f.id);
}
