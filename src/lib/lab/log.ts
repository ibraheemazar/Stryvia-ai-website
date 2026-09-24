import "server-only";
import { randomUUID } from "node:crypto";

// Structured JSON logging for the Lab (brief §9). One line per event, always
// with a request id so a session's turn can be traced end to end in Vercel
// logs. Never logs secrets, tokens, transcripts or contact details.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown> & {
  request_id?: string;
  session_id?: string;
  route?: string;
  duration_ms?: number;
};

const REDACT = [/token=[^&\s]+/gi, /Bearer\s+[A-Za-z0-9._-]+/g];

function redact(v: unknown): unknown {
  if (typeof v === "string") {
    let s = v;
    for (const re of REDACT) s = s.replace(re, "[redacted]");
    return s.length > 600 ? `${s.slice(0, 600)}…` : s;
  }
  return v;
}

export function newRequestId(): string {
  return randomUUID();
}

export function labLog(level: LogLevel, event: string, fields: LogFields = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    src: "lab",
    event,
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    entry[k] = v instanceof Error ? { name: v.name, message: redact(v.message) } : redact(v);
  }
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Time an async operation and log its duration. */
export async function timed<T>(
  event: string,
  fields: LogFields,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const out = await fn();
    labLog("info", event, { ...fields, duration_ms: Date.now() - started });
    return out;
  } catch (err) {
    labLog("error", `${event}.failed`, { ...fields, duration_ms: Date.now() - started, error: err as Error });
    throw err;
  }
}
