"use client";

// Client-side helpers shared by the Lab components: wire protocol, types and
// a tiny fetch wrapper. Mirrors the server's `TurnMeta`.

export const RS = "\x1e";

export type LabPhase = "intro" | "understand" | "expand" | "commit" | "review" | "done";
export type LabStatus = "in_progress" | "submitted" | "reviewed" | "closed" | "deleted";

export type SessionView = {
  id: string;
  name: string;
  language: "en" | "ar";
  status: LabStatus;
  phase: LabPhase;
  progress: number;
  turnCount: number;
  submittedAt: string | null;
  responseDays: number;
  busy: boolean;
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
  /** client-only: server error code for the failed turn (e.g. "provider") */
  failedCode?: string;
};

export type BriefView = {
  version: number;
  language: "en" | "ar";
  content: BriefContent;
  visitorEdited: boolean;
};

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
    automate: string;
    add_intelligence: string;
    productize: string;
    scale: string;
    honest_ceiling_note: string;
  };
  what_you_bring: string[];
  what_you_expect: string;
  constraints: string;
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

export async function labFetch<T>(url: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    ...init,
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
}

/**
 * Read a turn stream: calls `onText` with the accumulated visible text and
 * resolves with the trailing meta frame. Throws on network failure.
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
    return { phase: "understand", progress: 0, turnId: "", status: "in_progress", error: true, code: "no_meta" };
  }
}

/** Direction for user-generated text: Arabic-dominant → rtl, else ltr. */
export function textDir(text: string): "rtl" | "ltr" | "auto" {
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (ar === 0 && latin === 0) return "auto";
  return ar >= latin ? "rtl" : "ltr";
}
