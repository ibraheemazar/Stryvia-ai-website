import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getLabAi } from "@/lib/lab/ai";
import { getLatestAssessment } from "@/lib/lab/assessor";
import { getLabSettings } from "@/lib/lab/env";
import { JUDGE_FROZEN, VISITOR_FROZEN, buildJudgeUser, buildVisitorUser } from "@/lib/lab/prompts/judge";
import { JudgeSchema } from "@/lib/lab/schemas";
import { getLatestBrief, getSessionById, getState, listMessages } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Persona-harness support endpoint (brief §10.2). Lets the harness script run
// from anywhere without a local model key: the server plays the LLM visitor
// and the LLM judge, and exposes a session's private assessment for grading.
//
// Locked three ways: LAB_HARNESS_ENABLED must be "true", the request must carry
// `Authorization: Bearer $CRON_SECRET`, and it refuses to run in production.

const Schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("visitor_turn"), persona: z.string().max(6000), transcript: z.string().max(60_000), language: z.enum(["en", "ar"]) }),
  z.object({ op: z.literal("judge"), sessionId: z.string().uuid(), persona: z.string().max(6000) }),
  z.object({ op: z.literal("inspect"), sessionId: z.string().uuid() }),
]);

function allowed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || process.env.LAB_HARNESS_ENABLED !== "true") return false;
  if (getLabSettings().isProduction) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({ ok: false }, { status: 404 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  const body = parsed.data;

  if (body.op === "visitor_turn") {
    const stream = await getLabAi().stream({
      role: "visitor",
      sessionId: null,
      actor: "system",
      frozenSystem: VISITOR_FROZEN,
      dynamicSystem: `LANGUAGE HINT: ${body.language === "ar" ? "Arabic unless the card says mixed" : "English unless the card says mixed"}`,
      messages: [{ role: "user", content: buildVisitorUser({ persona: body.persona, transcript: body.transcript }) }],
      timeoutMs: 40_000,
      maxTokens: 500,
    });
    for await (const _ of stream.text) void _;
    const { text } = await stream.done;
    return NextResponse.json({ ok: true, text: text.trim() });
  }

  const session = await getSessionById(body.sessionId);
  if (!session) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const [messages, brief, assessment, state] = await Promise.all([listMessages(session.id), getLatestBrief(session.id), getLatestAssessment(session.id), getState(session.id)]);

  if (body.op === "inspect") {
    return NextResponse.json({
      ok: true,
      session: { id: session.id, status: session.status, phase: session.phase, turn_count: session.turn_count, token_usage: session.token_usage, language: session.language },
      slots: state.slots,
      brief: brief?.content ?? null,
      assessment: assessment
        ? { verdict: assessment.verdict, model_verdict: assessment.model_verdict, weighted_score: assessment.weighted_score, red_flags: assessment.red_flags, manipulation_detected: assessment.manipulation_detected, why_lines: assessment.why_lines }
        : null,
      guardrail_hits: messages.filter((m) => m.guardrail_hits).map((m) => ({ turn: m.turn_index, hits: m.guardrail_hits })),
    });
  }

  const transcript = messages.filter((m) => m.role !== "system").map((m) => `${m.role === "user" ? "VISITOR" : "STRYVIA AI"}: ${m.content}`).join("\n\n");
  const { value } = await getLabAi().structured({
    role: "judge",
    sessionId: session.id,
    actor: "system",
    frozenSystem: JUDGE_FROZEN,
    messages: [
      {
        role: "user",
        content: buildJudgeUser({
          persona: body.persona,
          transcript: transcript.slice(0, 60_000),
          brief: brief ? JSON.stringify(brief.content).slice(0, 20_000) : "(none)",
          assessment: assessment ? JSON.stringify({ verdict: assessment.verdict, scores: assessment.scores, red_flags: assessment.red_flags, why: assessment.why_lines }).slice(0, 20_000) : "(none)",
        }),
      },
    ],
    schema: JudgeSchema,
    timeoutMs: 100_000,
  });
  return NextResponse.json({ ok: true, judge: value });
}
