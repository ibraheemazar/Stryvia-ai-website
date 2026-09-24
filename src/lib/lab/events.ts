import "server-only";
import { insertEvent } from "./store";
import { labLog, type LogLevel } from "./log";

// Append-only audit/error events (brief §9). Payloads are PII-free by
// construction: only the allow-listed keys below survive, and any string value
// that looks like an email or phone number is dropped.

const ALLOWED_KEYS = new Set([
  "phase",
  "from_phase",
  "to_phase",
  "reasons",
  "turn_index",
  "rule",
  "rules",
  "code",
  "status",
  "verdict",
  "weighted_score",
  "provider",
  "purpose",
  "count",
  "duration_ms",
  "cost_usd",
  "tokens",
  "actor",
  "kind",
  "hits",
  "channel",
  "ok",
  "error",
  "language",
  "to_hash",
  "subject",
]);

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /\+?\d[\d\s-]{7,}\d/;

export function scrubPayload(payload: Record<string, unknown> | undefined | null): Record<string, unknown> | null {
  if (!payload) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (typeof v === "string") {
      if (EMAIL.test(v) || PHONE.test(v)) continue;
      out[k] = v.slice(0, 300);
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v
        .filter((x) => typeof x === "string" || typeof x === "number")
        .map((x) => (typeof x === "string" ? x.slice(0, 120) : x))
        .slice(0, 20);
    }
  }
  return out;
}

export async function labEvent(
  kind: string,
  level: LogLevel,
  opts: { sessionId?: string | null; requestId?: string | null; payload?: Record<string, unknown> | null } = {},
): Promise<void> {
  const payload = scrubPayload(opts.payload);
  labLog(level, kind, { session_id: opts.sessionId ?? undefined, request_id: opts.requestId ?? undefined, ...payload });
  try {
    await insertEvent({
      session_id: opts.sessionId ?? null,
      kind,
      level,
      payload,
      request_id: opts.requestId ?? null,
    });
  } catch {
    // Never let audit logging break the product.
  }
}
