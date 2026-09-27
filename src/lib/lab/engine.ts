import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { LAB_CONVERSATION, LAB_LIMITS, type LabLanguage } from "@/config/lab.config";
import { getLabAi, LabAiError } from "./ai";
import { attachmentLine } from "./attachment-policy";
import { getUnlinkedAttachments, linkAttachmentsToMessage } from "./attachments";
import { labEvent } from "./events";
import { lintAssistantText, looksLikeInjection, wrapUntrusted } from "./guardrails";
import { nextPhase, type PhaseDecision } from "./phase";
import { EXTRACTOR_FROZEN, buildExtractorUser } from "./prompts/extractor";
import { INTERVIEWER_FROZEN, buildInterviewerDynamic, lensText } from "./prompts/interviewer";
import { LENS_FROZEN, buildLensUser } from "./prompts/lens";
import { SUMMARY_FROZEN, buildSummaryUser } from "./prompts/summary";
import { IndustryLensSchema, RollingSummarySchema } from "./schemas";
import { ExtractorDiffSchema, describeState, mergeSlotDiff, type ExtractorDiff, type SlotState } from "./slots";
import {
  acquireTurnLock,
  deleteAssistantMessagesAfter,
  getSessionById,
  getState,
  insertMessage,
  listMessages,
  releaseTurnLock,
  saveState,
  updateSession,
  type LabMessageRow,
  type LabSessionRow,
} from "./store";

// The interview engine (brief §4.1–§4.3, §4.8): one visitor turn in, one
// streamed assistant turn out, with the extractor → phase controller →
// interviewer pipeline in between. All persistence happens here so a failed
// model call never loses the transcript.

export type TurnMeta = {
  phase: string;
  progress: number;
  turnId: string;
  status: string;
  options?: string[];
  ended?: boolean;
  budgetWarning?: boolean;
  error?: boolean;
  code?: string;
};

export type TurnOutcome = {
  /** Text deltas to stream to the client. */
  text: AsyncIterable<string>;
  /** Resolves with the trailing meta frame once persistence is done. */
  meta: Promise<TurnMeta>;
};

function toHistory(messages: LabMessageRow[], keep: number): Anthropic.MessageParam[] {
  const recent = messages.filter((m) => m.role !== "system").slice(-keep);
  const out: Anthropic.MessageParam[] = [];
  for (const m of recent) {
    const role = m.role === "user" ? "user" : "assistant";
    // Consecutive same-role messages are fine for the API; keep as is.
    out.push({ role, content: role === "user" ? wrapUntrusted(m.content) : m.content });
  }
  // The conversation must start with a user turn.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

async function runExtractor(
  session: LabSessionRow,
  slots: SlotState,
  rollingSummary: string | null,
  messages: LabMessageRow[],
  latest: LabMessageRow,
): Promise<ExtractorDiff | null> {
  const recent = messages
    .filter((m) => m.id !== latest.id && m.role !== "system")
    .slice(-6)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 1500) }));
  try {
    const { value } = await getLabAi().structured({
      role: "extract",
      sessionId: session.id,
      frozenSystem: EXTRACTOR_FROZEN,
      messages: [
        {
          role: "user",
          content: buildExtractorUser({
            phase: session.phase,
            slots,
            rollingSummary,
            recentTurns: recent,
            latestVisitorMessageWrapped: wrapUntrusted(latest.content),
          }),
        },
      ],
      schema: ExtractorDiffSchema,
      timeoutMs: 25_000,
    });
    return value;
  } catch (err) {
    await labEvent("extractor.failed", "error", {
      sessionId: session.id,
      payload: { code: err instanceof LabAiError ? err.code : "unknown", turn_index: latest.turn_index },
    });
    return null;
  }
}

async function maybeGenerateLens(
  session: LabSessionRow,
  slots: SlotState,
  current: { industry_lens: import("./schemas").IndustryLens | null },
): Promise<import("./schemas").IndustryLens | null> {
  const industry = slots.industry;
  if (!industry || industry.confidence < 0.6) return current.industry_lens;
  if (current.industry_lens && current.industry_lens.industry.toLowerCase() === industry.value.toLowerCase()) {
    return current.industry_lens;
  }
  if (current.industry_lens && industry.confidence < 0.85) return current.industry_lens; // only replace on strong signal
  try {
    const { value } = await getLabAi().structured({
      role: "lens",
      sessionId: session.id,
      frozenSystem: LENS_FROZEN,
      messages: [
        {
          role: "user",
          content: buildLensUser({
            industry: industry.value,
            geography: slots.geography?.value ?? session.country,
            stateText: describeState(slots),
          }),
        },
      ],
      schema: IndustryLensSchema,
      timeoutMs: 30_000,
    });
    await labEvent("lens.generated", "info", { sessionId: session.id, payload: { turn_index: session.turn_count } });
    return value;
  } catch (err) {
    await labEvent("lens.failed", "warn", {
      sessionId: session.id,
      payload: { code: err instanceof LabAiError ? err.code : "unknown" },
    });
    return current.industry_lens;
  }
}

async function maybeSummarise(
  session: LabSessionRow,
  messages: LabMessageRow[],
  state: { rolling_summary: string | null; summarised_through_turn: number },
): Promise<{ rolling_summary: string | null; summarised_through_turn: number }> {
  const convo = messages.filter((m) => m.role !== "system");
  if (convo.length <= LAB_CONVERSATION.rollingSummaryAfterMessages) return state;
  const cutoff = convo.length - LAB_CONVERSATION.keepVerbatimMessages;
  const toFold = convo.slice(0, cutoff).filter((m) => m.turn_index > state.summarised_through_turn);
  if (toFold.length < 4) return state;
  try {
    const { value } = await getLabAi().structured({
      role: "summary",
      sessionId: session.id,
      frozenSystem: SUMMARY_FROZEN,
      messages: [
        {
          role: "user",
          content: buildSummaryUser({
            previousSummary: state.rolling_summary,
            turns: toFold.map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) })),
          }),
        },
      ],
      schema: RollingSummarySchema,
      timeoutMs: 30_000,
    });
    const quotes = value.key_quotes.length ? `\nKey quotes: ${value.key_quotes.map((q) => `"${q}"`).join(" · ")}` : "";
    return {
      rolling_summary: `${value.summary}${quotes}`.slice(0, 6000),
      summarised_through_turn: toFold[toFold.length - 1].turn_index,
    };
  } catch (err) {
    await labEvent("summary.failed", "warn", {
      sessionId: session.id,
      payload: { code: err instanceof LabAiError ? err.code : "unknown" },
    });
    return state;
  }
}

/** Seed slots from the identity form so the interviewer never re-asks them. */
export function seedSlots(input: { country: string; company?: string | null; role?: string | null }): SlotState {
  const slots: SlotState = {
    geography: { value: input.country, confidence: 0.8, evidence: [{ turn_id: null, quote: "identity form" }], updated_turn: 0 },
  };
  return slots;
}

export type TurnInput = {
  session: LabSessionRow;
  content: string;
  inputMode: "text" | "voice";
  transcriptRaw?: string | null;
  clientTurnId: string;
  requestId: string;
  /** true when re-generating the assistant reply for the last visitor message */
  retry?: boolean;
  /** Files the visitor uploaded for this message (already stored). */
  attachmentIds?: string[];
};

const TEST_WORDS = /\b(fictional|fictitious|qa (re)?test|test (only|data|run)|not a real (lead|prospect|offer|request)|synthetic (test|data))\b|اختبار (وهمي|تجريبي)|بيانات تجريبية|ليس عرضًا حقيقيًا|ليست حالة حقيقية/i;
const NO_CONTACT_WORDS = /\b(do not|don't|dont|please don't|never) contact\b|\bno[- ]contact\b|not to be contacted|لا تتواصل|لا تواصل|عدم التواصل|ما تتواصلون/i;
const DECISION_WORDS = /\b(approve|accept|sign off|agree to|grant|confirm) (the |a |our |this |my )?(partnership|deal|equity|stake|funding|investment|project)\b|\bskip (the |ibrahim'?s |his |any )?(manual |human )?review\b|\b\d{1,2}\s?% (partnership|equity|stake)\b|وافق على الشراكة|اعتمد الشراكة|تخطَّ المراجعة|بدون مراجعة/i;

export function mergeFlags(
  current: import("./store").LabSessionFlags,
  hit: { test: boolean; no_contact: boolean; demands_decision: boolean },
): { value: import("./store").LabSessionFlags; changed: boolean; reasons: string[] } {
  const value = { ...current };
  const reasons: string[] = [];
  if (hit.test && !value.test) {
    value.test = true;
    reasons.push("test");
  }
  if (hit.no_contact && !value.no_contact) {
    value.no_contact = true;
    reasons.push("no_contact");
  }
  if (hit.demands_decision) {
    value.decision_demands = (value.decision_demands ?? 0) + 1;
    reasons.push("decision_demand");
  }
  return { value, changed: reasons.length > 0, reasons };
}

export class TurnBusyError extends Error {
  constructor() {
    super("A turn is already in progress for this session.");
    this.name = "TurnBusyError";
  }
}

/**
 * Process one visitor turn. Persists the visitor message first, then runs the
 * extractor, phase controller and interviewer. Returns a text stream and a
 * meta promise; the caller writes both to the HTTP response.
 */
export async function runTurn(input: TurnInput): Promise<TurnOutcome> {
  const { session } = input;
  const locked = await acquireTurnLock(session.id, input.clientTurnId, LAB_LIMITS.turnLockTtlSeconds);
  if (!locked) throw new TurnBusyError();

  try {
    const existing = await listMessages(session.id);
    let messages = existing;
    let latest: LabMessageRow;
    let turnCount = session.turn_count;
    let turnsInPhase = session.turns_in_phase;

    if (input.retry) {
      const lastUser = [...existing].reverse().find((m) => m.role === "user");
      if (!lastUser) throw new Error("Nothing to retry.");
      await deleteAssistantMessagesAfter(session.id, lastUser.turn_index);
      messages = existing.filter((m) => !(m.role === "assistant" && m.turn_index >= lastUser.turn_index));
      latest = lastUser;
    } else {
      turnCount += 1;
      turnsInPhase += 1;
      // Files sent with this message: the transcript records them by name from
      // the stored rows (never from client text), and each row is linked to
      // the message so the owner sees exactly what came with what.
      const files = await getUnlinkedAttachments(session.id, input.attachmentIds ?? []);
      const line = attachmentLine(files.map((f) => ({ name: f.file_name, size: Number(f.size_bytes) })), session.language as LabLanguage);
      latest = await insertMessage({
        session_id: session.id,
        turn_index: turnCount,
        role: "user",
        content: [input.content.trim(), line].filter(Boolean).join("\n\n"),
        input_mode: input.inputMode,
        transcript_raw: input.transcriptRaw ?? null,
      });
      if (files.length) await linkAttachmentsToMessage(session.id, files.map((f) => f.id), latest.id);
      messages = [...existing, latest];
      await updateSession(session.id, {
        turn_count: turnCount,
        turns_in_phase: turnsInPhase,
        last_active_at: new Date().toISOString(),
        ...(session.first_message_at ? {} : { first_message_at: new Date().toISOString() }),
      });
    }

    const state = await getState(session.id);
    const isFirstTurn = turnCount === 1 && !input.retry;

    // 1) Extract
    const diff = await runExtractor(session, state.slots, state.rolling_summary, messages, latest);
    const injection = looksLikeInjection(latest.content) || Boolean(diff?.signals.injection_attempt);
    let slots = diff ? mergeSlotDiff(state.slots, diff, { id: latest.id, index: latest.turn_index }) : state.slots;
    if (diff?.signals.sensitive_disclosure) {
      // Do not keep evidence quotes from a sensitive disclosure (§4.6).
      slots = mergeSlotDiff(state.slots, { ...diff, slot_updates: [] }, { id: latest.id, index: latest.turn_index });
    }
    const signals = diff?.signals ?? {
      wants_to_finish: false,
      off_topic: false,
      abusive: false,
      sensitive_disclosure: false,
      injection_attempt: injection,
      visitor_is_struggling: false,
      is_test_or_fictional: false,
      no_contact_requested: false,
      demands_decision: false,
    };
    // Workflow flags: set from the extractor OR deterministic keyword checks on
    // the visitor's own words, stored outside any generated prose, never cleared.
    const flags = mergeFlags(session.flags ?? {}, {
      test: signals.is_test_or_fictional || TEST_WORDS.test(latest.content),
      no_contact: signals.no_contact_requested || NO_CONTACT_WORDS.test(latest.content),
      demands_decision: signals.demands_decision || DECISION_WORDS.test(latest.content),
    });
    if (flags.changed) {
      await updateSession(session.id, { flags: flags.value });
      await labEvent("session.flags", "info", { sessionId: session.id, requestId: input.requestId, payload: { kind: flags.reasons.join(","), turn_index: turnCount } });
    }
    const strikes = signals.abusive || signals.off_topic ? session.strikes + 1 : 0;

    // 2) Decide phase (deterministic)
    const decision: PhaseDecision = nextPhase({
      phase: session.phase,
      slots,
      turnCount,
      turnsInPhase,
      tokensUsed: (session.token_usage?.input ?? 0) + (session.token_usage?.output ?? 0),
      signals: { ...signals, wants_to_finish: signals.wants_to_finish && (session.finish_nudged || true) },
      strikes,
    });
    const finishTooEarly = decision.reasons.includes("visitor_finish_too_early") && !session.finish_nudged;
    // Second time they ask to finish, honour it even with thin coverage.
    let phase = decision.phase;
    if (decision.reasons.includes("visitor_finish_too_early") && session.finish_nudged) phase = "review";
    if (decision.transitioned || phase !== session.phase) turnsInPhase = 0;

    // 3) Lens + summary (best effort)
    const lens = await maybeGenerateLens(session, slots, state);
    const summarised = await maybeSummarise(session, messages, state);

    await saveState(session.id, {
      slots,
      industry_lens: lens,
      rolling_summary: summarised.rolling_summary,
      summarised_through_turn: summarised.summarised_through_turn,
    });
    await updateSession(session.id, {
      phase,
      turns_in_phase: turnsInPhase,
      strikes,
      finish_nudged: session.finish_nudged || finishTooEarly,
    });
    if (phase !== session.phase) {
      await labEvent("phase.transition", "info", {
        sessionId: session.id,
        requestId: input.requestId,
        payload: { from_phase: session.phase, to_phase: phase, reasons: decision.reasons, turn_index: turnCount },
      });
    }
    if (injection) {
      await labEvent("guardrail.injection_attempt", "warn", {
        sessionId: session.id,
        requestId: input.requestId,
        payload: { turn_index: turnCount },
      });
    }

    // 4) Interviewer stream
    const dynamic = buildInterviewerDynamic({
      language: session.language as LabLanguage,
      phase,
      visitorName: session.visitor_name,
      focus: decision.focus,
      slots,
      lens,
      rollingSummary: summarised.rolling_summary,
      struggling: signals.visitor_is_struggling,
      finishRequestedTooEarly: finishTooEarly,
      capReached: decision.capReached,
      terminate: decision.terminate,
      isFirstTurn,
      offTopic: signals.off_topic,
      abusive: signals.abusive,
      sensitive: signals.sensitive_disclosure,
    });
    const history = toHistory(messages, LAB_CONVERSATION.keepVerbatimMessages);
    const stream = await getLabAi().stream({
      role: "interview",
      sessionId: session.id,
      frozenSystem: INTERVIEWER_FROZEN,
      dynamicSystem: dynamic,
      messages: history,
      timeoutMs: 50_000,
    });

    const budgetUsed = ((session.token_usage?.input ?? 0) + (session.token_usage?.output ?? 0)) / LAB_CONVERSATION.tokenBudget;

    const meta: Promise<TurnMeta> = stream.done
      .then(async ({ text, usage, stopReason }) => {
        // Late-response guard: if the lock has moved on (the visitor retried
        // after a timeout and a newer turn owns the session), this reply is
        // stale — never persist it, never let it interleave.
        const owner = await getSessionById(session.id);
        if (owner?.pending_turn_id !== input.clientTurnId) {
          await labEvent("turn.late_discarded", "warn", { sessionId: session.id, requestId: input.requestId, payload: { turn_index: turnCount } });
          return { phase, progress: decision.progress, turnId: latest.id, status: session.status, error: true, code: "superseded" } satisfies TurnMeta;
        }
        const hits = lintAssistantText(text);
        await insertMessage({
          session_id: session.id,
          turn_index: turnCount,
          role: "assistant",
          content: text,
          input_mode: "text",
          model: "interview",
          usage: { input: usage.input, output: usage.output, cache_read: usage.cacheRead },
          guardrail_hits: hits.length ? hits : null,
        });
        if (hits.length) {
          await labEvent("guardrail.output_hit", "warn", {
            sessionId: session.id,
            requestId: input.requestId,
            payload: { rules: hits.map((h) => h.rule), turn_index: turnCount },
          });
        }
        const ended = decision.terminate || stopReason === "refusal";
        if (decision.terminate) {
          await updateSession(session.id, { status: "closed", phase: "done" });
        }
        return {
          phase,
          progress: decision.progress,
          turnId: latest.id,
          status: decision.terminate ? "closed" : session.status,
          ended: ended || undefined,
          budgetWarning: budgetUsed >= LAB_CONVERSATION.budgetWarnAt || undefined,
        } satisfies TurnMeta;
      })
      .catch(async (err) => {
        const code = err instanceof LabAiError ? err.code : "unknown";
        await labEvent("interviewer.failed", "error", {
          sessionId: session.id,
          requestId: input.requestId,
          payload: { code, turn_index: turnCount },
        });
        return { phase, progress: decision.progress, turnId: latest.id, status: session.status, error: true, code } satisfies TurnMeta;
      })
      .finally(() => releaseTurnLock(session.id, input.clientTurnId));

    return { text: stream.text, meta };
  } catch (err) {
    await releaseTurnLock(session.id, input.clientTurnId);
    throw err;
  }
}

export { lensText };
