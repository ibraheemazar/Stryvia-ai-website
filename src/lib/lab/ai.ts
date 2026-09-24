import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { LAB_EFFORT, LAB_MAX_TOKENS, LAB_PRICES_PER_MTOK, type LabModelRole } from "@/config/lab.config";
import { getAnthropic } from "@/lib/anthropic";
import { getLabSettings } from "./env";
import { labLog } from "./log";
import { logAiCall, addUsage } from "./store";
import { mockProvider } from "./ai-mock";

// The one place the Lab talks to a model (brief §4, §4.8). Handles prompt
// caching (frozen system block), structured outputs, timeouts, bounded retries,
// refusal/max_tokens handling and usage → cost logging. The mock provider is
// only reachable through this module (repo-guard test).

export type Usage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
};

export type StructuredCall<T> = {
  role: LabModelRole;
  sessionId: string | null;
  actor?: "visitor" | "system" | "admin";
  frozenSystem: string;
  dynamicSystem?: string;
  messages: Anthropic.MessageParam[];
  schema: z.ZodType<T>;
  timeoutMs?: number;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh";
};

export type StreamCall = {
  role: LabModelRole;
  sessionId: string | null;
  actor?: "visitor" | "system" | "admin";
  frozenSystem: string;
  dynamicSystem?: string;
  messages: Anthropic.MessageParam[];
  timeoutMs?: number;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh";
};

export type StreamResult = {
  /** Async iterable of text deltas. */
  text: AsyncIterable<string>;
  /** Resolves after the stream ends with the final text and usage. */
  done: Promise<{ text: string; usage: Usage; stopReason: string | null }>;
};

export interface LabAiProvider {
  structured<T>(call: StructuredCall<T>): Promise<{ value: T; usage: Usage }>;
  stream(call: StreamCall): Promise<StreamResult>;
}

export class LabAiError extends Error {
  constructor(
    public code: "timeout" | "rate_limited" | "refusal" | "truncated" | "invalid_output" | "provider" | "not_configured",
    message: string,
  ) {
    super(message);
    this.name = "LabAiError";
  }
}

export function computeCost(model: string, u: Omit<Usage, "costUsd">): number {
  const p = LAB_PRICES_PER_MTOK[model] ?? LAB_PRICES_PER_MTOK["claude-sonnet-5"];
  const cost =
    (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function usageFrom(model: string, u: Anthropic.Usage | null | undefined): Usage {
  const base = {
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
  return { ...base, costUsd: computeCost(model, base) };
}

function systemBlocks(frozen: string, dynamic?: string): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: frozen, cache_control: { type: "ephemeral" } },
  ];
  if (dynamic) blocks.push({ type: "text", text: dynamic });
  return blocks;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.InternalServerError) return true;
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError && (err.status === 529 || err.status === 503)) return true;
  return false;
}

function toLabError(err: unknown): LabAiError {
  if (err instanceof LabAiError) return err;
  if (err instanceof Anthropic.RateLimitError) return new LabAiError("rate_limited", err.message);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new LabAiError("timeout", err.message);
  if (err instanceof Anthropic.APIError) return new LabAiError("provider", `${err.status ?? ""} ${err.message}`.trim());
  if (err instanceof Error && err.name === "AbortError") return new LabAiError("timeout", err.message);
  return new LabAiError("provider", err instanceof Error ? err.message : String(err));
}

async function record(
  call: { role: LabModelRole; sessionId: string | null; actor?: "visitor" | "system" | "admin" },
  model: string,
  usage: Usage,
  latencyMs: number,
  ok: boolean,
  errorCode?: string,
) {
  await logAiCall({
    session_id: call.sessionId,
    purpose: call.role,
    actor: call.actor ?? "visitor",
    model,
    input_tokens: usage.input,
    output_tokens: usage.output,
    cache_read_tokens: usage.cacheRead,
    cache_write_tokens: usage.cacheWrite,
    latency_ms: latencyMs,
    cost_usd: usage.costUsd,
    ok,
    error_code: errorCode ?? null,
  });
  if (call.sessionId && (usage.input || usage.output)) {
    try {
      await addUsage(call.sessionId, usage);
    } catch (err) {
      labLog("error", "ai.usage_accumulate_failed", { session_id: call.sessionId, error: err as Error });
    }
  }
}

const anthropicProvider: LabAiProvider = {
  async structured<T>(call: StructuredCall<T>) {
    const settings = getLabSettings();
    const model = settings.models[call.role];
    const client = getAnthropic();
    const started = Date.now();
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        const msg = await client.messages.parse(
          {
            model,
            max_tokens: call.maxTokens ?? LAB_MAX_TOKENS[call.role],
            system: systemBlocks(call.frozenSystem, call.dynamicSystem),
            messages: call.messages,
            output_config: {
              format: zodOutputFormat(call.schema),
              effort: call.effort ?? LAB_EFFORT[call.role],
            },
          },
          { timeout: call.timeoutMs ?? 60_000, maxRetries: 0 },
        );
        const usage = usageFrom(model, msg.usage);
        if (msg.stop_reason === "refusal") {
          await record(call, model, usage, Date.now() - started, false, "refusal");
          throw new LabAiError("refusal", "The model declined this request.");
        }
        if (msg.stop_reason === "max_tokens") {
          await record(call, model, usage, Date.now() - started, false, "truncated");
          throw new LabAiError("truncated", "Structured output was cut off by max_tokens.");
        }
        const value = msg.parsed_output;
        if (value == null) {
          await record(call, model, usage, Date.now() - started, false, "invalid_output");
          throw new LabAiError("invalid_output", "Model output did not match the schema.");
        }
        await record(call, model, usage, Date.now() - started, true);
        return { value: value as T, usage };
      } catch (err) {
        if (err instanceof LabAiError) throw err;
        if (attempt < 2 && isRetryable(err)) {
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
          continue;
        }
        const lab = toLabError(err);
        await record(call, model, usageFrom(model, null), Date.now() - started, false, lab.code);
        throw lab;
      }
    }
  },

  async stream(call: StreamCall) {
    const settings = getLabSettings();
    const model = settings.models[call.role];
    const client = getAnthropic();
    const started = Date.now();

    const s = client.messages.stream(
      {
        model,
        max_tokens: call.maxTokens ?? LAB_MAX_TOKENS[call.role],
        system: systemBlocks(call.frozenSystem, call.dynamicSystem),
        messages: call.messages,
        output_config: { effort: call.effort ?? LAB_EFFORT[call.role] },
      },
      { timeout: call.timeoutMs ?? 60_000, maxRetries: 1 },
    );

    async function* text() {
      for await (const event of s) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    }

    const done = (async () => {
      try {
        const final = await s.finalMessage();
        const usage = usageFrom(model, final.usage);
        const out = final.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        const ok = final.stop_reason !== "refusal";
        await record(call, model, usage, Date.now() - started, ok, ok ? undefined : "refusal");
        return { text: out, usage, stopReason: final.stop_reason };
      } catch (err) {
        const lab = toLabError(err);
        await record(call, model, usageFrom(model, null), Date.now() - started, false, lab.code);
        throw lab;
      }
    })();

    return { text: text(), done };
  },
};

export function getLabAi(): LabAiProvider {
  const settings = getLabSettings();
  if (settings.aiProvider === "mock") {
    if (settings.isProduction) throw new LabAiError("not_configured", "Mock AI provider is not allowed in production.");
    return mockProvider;
  }
  return anthropicProvider;
}
