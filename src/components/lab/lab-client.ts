"use client";

// Client-side helpers shared by the Lab components: wire protocol, types and
// a tiny fetch wrapper. Mirrors the server's `TurnMeta` and brief views.

export const RS = "\x1e";

export type LabPhase = "intro" | "understand" | "expand" | "commit" | "review" | "done";
export type LabStatus = "in_progress" | "submitted" | "reviewed" | "closed" | "deleted";

export type SessionView = {
  id: string;
  name: string;
  /** Conversation language (what the interviewer speaks). Not the document language. */
  language: "en" | "ar";
  status: LabStatus;
  phase: LabPhase;
  progress: number;
  turnCount: number;
  submittedAt: string | null;
  submittedVersion: number | null;
  /** Owner-configured response commitment, or null when none is promised. */
  responseDays: number | null;
  /** An operation is running server-side (turn, brief); wait, do not retry. */
  busy: boolean;
  /** The last visitor message has no reply and nothing is running. */
  unanswered: boolean;
};

export type MessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  inputMode: "text" | "voice";
  createdAt?: string;
  /** client-only: streaming in progress */
  pending?: boolean;
  /** client-only: failed turn awaiting retry */
  failed?: boolean;
  /** client-only: why it failed (provider | timeout | interrupted | network | busy | unanswered | superseded) */
  failedCode?: string;
  /** client-only: the exact text typed, for a safe re-send if it never reached the server */
  sentText?: string;
  /** client-only: stored attachments sent with this message */
  attachmentIds?: string[];
};

export type BriefKind = "generated" | "edited" | "translated" | "revised";
export type BriefVersionStatus = "current" | "submitted" | "proposed" | "superseded";

export type BriefView = {
  version: number;
  /** Document language — drives labels, direction and the translate target. */
  language: "en" | "ar";
  content: BriefContent;
  visitorEdited: boolean;
  kind: BriefKind;
  sourceVersion: number | null;
  status: BriefVersionStatus;
  createdAt: string;
};

export type BriefVersionInfo = {
  version: number;
  language: "en" | "ar";
  kind: BriefKind;
  sourceVersion: number | null;
  createdAt: string;
  status: BriefVersionStatus;
};

export type BriefChange = { path: string; before: string; after: string };

export type BriefContent = {
  title: string;
  one_line: string;
  what_you_came_with: {
    problem: string;
    who_is_affected: string;
    current_process: string[];
    frequency_and_volume: string;
    cost_today: string;
    tried_so_far: string;
    tools: string;
    desired_outcome: string;
  };
  what_it_could_become: {
    intro: string;
    automate: string | null;
    add_intelligence: string | null;
    productize: string | null;
    scale: string | null;
    honest_ceiling_note: string;
  };
  what_you_bring: string[];
  what_you_expect: string;
  constraints: string;
  scope: { confirmed: string[]; excluded: string[]; assumptions: string[]; open_questions: string[] };
  next_step_note: string;
};

export type TurnMeta = {
  phase: LabPhase;
  progress: number;
  turnId: string;
  status: LabStatus;
  options?: string[];
  ended?: boolean;
  budgetWarning?: boolean;
  error?: boolean;
  code?: string;
};

export function newClientTurnId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function labFetch<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<{ status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "same-origin",
    });
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      data = {} as T;
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a turn stream: calls `onText` with the accumulated visible text and
 * resolves with the trailing meta frame. Throws on network failure. A stream
 * that ends without a meta frame (function killed, connection cut) resolves
 * with `error: true, code: "interrupted"` so the caller offers Retry.
 */
export async function readTurnStream(res: Response, onText: (text: string) => void): Promise<TurnMeta> {
  if (!res.ok || !res.body) {
    let payload: { error?: string } = {};
    try {
      payload = await res.json();
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(payload.error ?? `http_${res.status}`), { status: res.status, code: payload.error });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let visible = "";
  let metaRaw = "";
  let inMeta = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (inMeta) {
      metaRaw += chunk;
      continue;
    }
    const idx = chunk.indexOf(RS);
    if (idx === -1) {
      visible += chunk;
      onText(visible);
    } else {
      visible += chunk.slice(0, idx);
      onText(visible);
      inMeta = true;
      metaRaw += chunk.slice(idx + 1);
    }
  }
  try {
    return JSON.parse(metaRaw) as TurnMeta;
  } catch {
    return { phase: "understand", progress: 0, turnId: "", status: "in_progress", error: true, code: "interrupted" };
  }
}

/** Direction for user-generated text: Arabic-dominant → rtl, else ltr. */
export function textDir(text: string): "rtl" | "ltr" | "auto" {
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (ar === 0 && latin === 0) return "auto";
  return ar >= latin ? "rtl" : "ltr";
}

/** Human label for a brief field path, from the `lab.brief.fields` catalog. */
export const FIELD_KEY: Record<string, string> = {
  title: "title",
  one_line: "one_line",
  "what_you_came_with.problem": "problem",
  "what_you_came_with.who_is_affected": "who",
  "what_you_came_with.current_process": "process",
  "what_you_came_with.frequency_and_volume": "frequency",
  "what_you_came_with.cost_today": "cost",
  "what_you_came_with.tried_so_far": "tried",
  "what_you_came_with.tools": "tools",
  "what_you_came_with.desired_outcome": "outcome",
  "what_it_could_become.intro": "intro",
  "what_it_could_become.automate": "automate",
  "what_it_could_become.add_intelligence": "intelligence",
  "what_it_could_become.productize": "productize",
  "what_it_could_become.scale": "scale",
  "what_it_could_become.honest_ceiling_note": "ceiling",
  what_you_bring: "bring",
  what_you_expect: "expect",
  constraints: "constraints",
  "scope.confirmed": "confirmed",
  "scope.excluded": "excluded",
  "scope.assumptions": "assumptions",
  "scope.open_questions": "openQuestions",
  next_step_note: "next",
};
