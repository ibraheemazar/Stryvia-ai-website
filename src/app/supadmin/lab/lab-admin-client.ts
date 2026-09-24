"use client";

// Client helpers + types for the Lab admin. Mirrors `lib/lab/admin.ts` shapes.

export type ListRow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  status: string;
  phase: string;
  language: string;
  visitor_name: string;
  email: string;
  company: string | null;
  country: string;
  turn_count: number;
  cost_usd: number;
  industry: string | null;
  verdict: string | null;
  weighted_score: number | null;
  assessment_status: string;
  has_decision: boolean;
  awaiting_decision: boolean;
};

export type Stats = {
  sessions_started?: number;
  sessions_submitted?: number;
  completion_rate?: number;
  avg_session_minutes?: number;
  avg_turns?: number;
  avg_cost_usd?: number;
  total_cost_usd?: number;
  per_week?: Array<{ week: string; started: number; submitted: number }>;
  verdicts?: Record<string, number>;
  languages?: Record<string, number>;
};

export type DimensionScore = { score: number; evidence: string[]; note: string };

export type Assessment = {
  id: string;
  rubric_version: string;
  prompt_version: string;
  model: string;
  scores: Record<string, DimensionScore>;
  red_flags: Array<{ id: string; triggered: boolean; evidence: string }>;
  verdict: string;
  model_verdict: string | null;
  weighted_score: number;
  confidence: number;
  reasoning: string;
  why_lines: string[];
  proposed_plan: { what_stryvia_could_build: string; rough_scope: string; suggested_deal_shape: string; open_questions: string[] } | null;
  manipulation_detected: boolean;
  actor: string;
  created_at: string;
};

export type Detail = {
  session: {
    id: string;
    visitor_name: string;
    email: string;
    phone_e164: string;
    country: string;
    company: string | null;
    role: string | null;
    language: "en" | "ar";
    status: string;
    phase: string;
    turn_count: number;
    token_usage: { input: number; output: number; cache_read: number; cost_usd: number };
    prompt_version: string;
    assessment_status: string;
    created_at: string;
    submitted_at: string | null;
    consent_version: string;
    consent_at: string;
  };
  messages: Array<{ id: string; role: string; content: string; input_mode: string; transcript_raw: string | null; created_at: string; guardrail_hits: unknown }>;
  state: { slots: Record<string, unknown>; industry_lens: Record<string, unknown> | null; rolling_summary: string | null };
  brief: { version: number; language: "en" | "ar"; content: Record<string, unknown>; rendered_html: string; visitor_edited: boolean } | null;
  assessment: Assessment | null;
  assessments: Assessment[];
  decisions: Array<{ id: string; decision: string; notes: string | null; decided_by: string; decided_at: string; outbound_email_subject: string | null; outbound_email_body: string | null; outbound_email_sent_at: string | null }>;
  notes: Array<{ id: string; author: string; body: string; created_at: string }>;
};

export const VERDICT_LABEL: Record<string, string> = {
  productize: "Productize",
  paid_build: "Paid build",
  priority_call: "Priority call",
  refer_or_pass: "Refer / pass",
};

export const DIMENSION_LABEL: Record<string, string> = {
  market_repeatability: "Market repeatability",
  pain_intensity: "Pain intensity",
  stryvia_fit: "Stryvia fit",
  effort_vs_value: "Effort vs value",
  person_contribution: "Contribution",
  deal_alignment: "Deal alignment",
  founder_signal: "Founder signal",
};

export async function adminFetch<T>(token: string, url: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  return { status: res.status, data };
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function verdictTone(v: string | null): string {
  switch (v) {
    case "priority_call":
      return "border-sv-green-line text-sv-green";
    case "productize":
      return "border-sv-green-line/60 text-sv-text";
    case "paid_build":
      return "border-sv-line-strong text-sv-text-2";
    case "refer_or_pass":
      return "border-sv-line text-sv-text-3";
    default:
      return "border-sv-line text-sv-text-3";
  }
}
