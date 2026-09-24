import "server-only";
import { getServiceSupabase } from "@/lib/supabase";
import type { LabLanguage, LabPhase, LabStatus } from "@/config/lab.config";
import type { SlotState } from "./slots";
import type { IndustryLens } from "./schemas";

// All database access for the Idea Lab. Service role only (RLS denies every
// other role). Ownership is enforced by callers via `session-auth.ts`.

export type LabVisitorRow = {
  id: string;
  email: string;
  cookie_generation: number;
  email_verified_at: string | null;
  created_at: string;
};

export type TokenUsage = {
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  cost_usd: number;
};

export type LabSessionRow = {
  id: string;
  visitor_id: string;
  visitor_name: string;
  email: string;
  phone_e164: string;
  country: string;
  company: string | null;
  role: string | null;
  language: LabLanguage;
  status: LabStatus;
  phase: LabPhase;
  consent_version: string;
  consent_at: string;
  prompt_version: string;
  rubric_version: string | null;
  token_usage: TokenUsage;
  turn_count: number;
  turns_in_phase: number;
  strikes: number;
  finish_nudged: boolean;
  pending_turn_id: string | null;
  pending_started_at: string | null;
  assessment_status: "none" | "pending" | "running" | "done" | "failed";
  first_message_at: string | null;
  last_active_at: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LabMessageRow = {
  id: string;
  session_id: string;
  turn_index: number;
  role: "user" | "assistant" | "system";
  content: string;
  input_mode: "text" | "voice";
  transcript_raw: string | null;
  model: string | null;
  usage: Record<string, number> | null;
  guardrail_hits: unknown | null;
  created_at: string;
};

export type LabStateRow = {
  session_id: string;
  slots: SlotState;
  industry_lens: IndustryLens | null;
  rolling_summary: string | null;
  summarised_through_turn: number;
  updated_at: string;
};

export type LabBriefRow = {
  id: string;
  session_id: string;
  version: number;
  language: LabLanguage;
  content: unknown;
  rendered_html: string;
  visitor_edited: boolean;
  created_at: string;
};

function db() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  return supabase;
}

export class LabStoreError extends Error {
  constructor(op: string, detail: string) {
    super(`${op}: ${detail}`);
    this.name = "LabStoreError";
  }
}

// ---- Visitors --------------------------------------------------------------

export async function upsertVisitor(email: string): Promise<LabVisitorRow> {
  const e = email.trim().toLowerCase();
  const { data, error } = await db()
    .from("lab_visitors")
    .upsert({ email: e }, { onConflict: "email", ignoreDuplicates: false })
    .select("*")
    .single();
  if (error || !data) throw new LabStoreError("upsertVisitor", error?.message ?? "no row");
  return data as LabVisitorRow;
}

export async function getVisitorById(id: string): Promise<LabVisitorRow | null> {
  const { data } = await db().from("lab_visitors").select("*").eq("id", id).maybeSingle();
  return (data as LabVisitorRow | null) ?? null;
}

export async function getVisitorByEmail(email: string): Promise<LabVisitorRow | null> {
  const { data } = await db()
    .from("lab_visitors")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return (data as LabVisitorRow | null) ?? null;
}

export async function bumpVisitorGeneration(id: string): Promise<void> {
  const { data } = await db().from("lab_visitors").select("cookie_generation").eq("id", id).maybeSingle();
  const gen = ((data as { cookie_generation: number } | null)?.cookie_generation ?? 1) + 1;
  await db().from("lab_visitors").update({ cookie_generation: gen }).eq("id", id);
}

export async function markEmailVerified(id: string): Promise<void> {
  await db()
    .from("lab_visitors")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", id)
    .is("email_verified_at", null);
}

// ---- Sessions --------------------------------------------------------------

export type NewSession = {
  visitor_id: string;
  visitor_name: string;
  email: string;
  phone_e164: string;
  country: string;
  company?: string | null;
  role?: string | null;
  language: LabLanguage;
  consent_version: string;
  prompt_version: string;
  ip_hash?: string | null;
  user_agent?: string | null;
};

export async function createSession(input: NewSession, initialSlots: SlotState): Promise<LabSessionRow> {
  const { data, error } = await db().from("lab_sessions").insert(input).select("*").single();
  if (error || !data) throw new LabStoreError("createSession", error?.message ?? "no row");
  const session = data as LabSessionRow;
  const { error: sErr } = await db()
    .from("lab_idea_state")
    .insert({ session_id: session.id, slots: initialSlots });
  if (sErr) throw new LabStoreError("createSession.state", sErr.message);
  return session;
}

export async function getSessionById(id: string): Promise<LabSessionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("lab_sessions").select("*").eq("id", id).maybeSingle();
  return (data as LabSessionRow | null) ?? null;
}

export async function listSessionsForVisitor(visitorId: string): Promise<LabSessionRow[]> {
  const { data } = await db()
    .from("lab_sessions")
    .select("*")
    .eq("visitor_id", visitorId)
    .neq("status", "deleted")
    .order("last_active_at", { ascending: false });
  return (data as LabSessionRow[]) ?? [];
}

export async function updateSession(id: string, patch: Partial<LabSessionRow>): Promise<void> {
  const { error } = await db().from("lab_sessions").update(patch).eq("id", id);
  if (error) throw new LabStoreError("updateSession", error.message);
}

export async function countSessionsForEmailToday(email: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db()
    .from("lab_sessions")
    .select("id", { count: "exact", head: true })
    .eq("email", email.trim().toLowerCase())
    .gte("created_at", since);
  return count ?? 0;
}

export async function acquireTurnLock(sessionId: string, turnId: string, ttlSeconds: number): Promise<boolean> {
  const { data, error } = await db().rpc("lab_acquire_turn", {
    p_session_id: sessionId,
    p_turn_id: turnId,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw new LabStoreError("acquireTurnLock", error.message);
  return data === true;
}

export async function releaseTurnLock(sessionId: string, turnId: string): Promise<void> {
  await db()
    .from("lab_sessions")
    .update({ pending_turn_id: null, pending_started_at: null })
    .eq("id", sessionId)
    .eq("pending_turn_id", turnId);
}

export async function addUsage(
  sessionId: string,
  u: { input: number; output: number; cacheRead: number; cacheWrite: number; costUsd: number },
): Promise<void> {
  const { error } = await db().rpc("lab_add_usage", {
    p_session_id: sessionId,
    p_input: u.input,
    p_output: u.output,
    p_cache_read: u.cacheRead,
    p_cache_write: u.cacheWrite,
    p_cost: u.costUsd,
  });
  if (error) throw new LabStoreError("addUsage", error.message);
}

// ---- Messages --------------------------------------------------------------

export async function listMessages(sessionId: string): Promise<LabMessageRow[]> {
  const { data, error } = await db()
    .from("lab_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new LabStoreError("listMessages", error.message);
  return (data as LabMessageRow[]) ?? [];
}

export async function insertMessage(
  m: Omit<LabMessageRow, "id" | "created_at" | "transcript_raw" | "model" | "usage" | "guardrail_hits"> &
    Partial<Pick<LabMessageRow, "transcript_raw" | "model" | "usage" | "guardrail_hits">>,
): Promise<LabMessageRow> {
  const { data, error } = await db().from("lab_messages").insert(m).select("*").single();
  if (error || !data) throw new LabStoreError("insertMessage", error?.message ?? "no row");
  return data as LabMessageRow;
}

export async function deleteAssistantMessagesAfter(sessionId: string, turnIndex: number): Promise<void> {
  await db()
    .from("lab_messages")
    .delete()
    .eq("session_id", sessionId)
    .eq("role", "assistant")
    .gte("turn_index", turnIndex);
}

// ---- State -----------------------------------------------------------------

export async function getState(sessionId: string): Promise<LabStateRow> {
  const { data, error } = await db().from("lab_idea_state").select("*").eq("session_id", sessionId).maybeSingle();
  if (error) throw new LabStoreError("getState", error.message);
  return (
    (data as LabStateRow | null) ?? {
      session_id: sessionId,
      slots: {},
      industry_lens: null,
      rolling_summary: null,
      summarised_through_turn: 0,
      updated_at: new Date().toISOString(),
    }
  );
}

export async function saveState(sessionId: string, patch: Partial<Omit<LabStateRow, "session_id">>): Promise<void> {
  const { error } = await db()
    .from("lab_idea_state")
    .upsert({ session_id: sessionId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "session_id" });
  if (error) throw new LabStoreError("saveState", error.message);
}

// ---- Briefs ----------------------------------------------------------------

export async function getLatestBrief(sessionId: string): Promise<LabBriefRow | null> {
  const { data } = await db()
    .from("lab_briefs")
    .select("*")
    .eq("session_id", sessionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LabBriefRow | null) ?? null;
}

export async function saveBrief(
  sessionId: string,
  b: { language: LabLanguage; content: unknown; rendered_html: string; visitor_edited: boolean },
): Promise<LabBriefRow> {
  const latest = await getLatestBrief(sessionId);
  const version = (latest?.version ?? 0) + 1;
  const { data, error } = await db()
    .from("lab_briefs")
    .insert({ session_id: sessionId, version, ...b })
    .select("*")
    .single();
  if (error || !data) throw new LabStoreError("saveBrief", error?.message ?? "no row");
  return data as LabBriefRow;
}

// ---- AI call log -----------------------------------------------------------

export async function logAiCall(row: {
  session_id: string | null;
  purpose: string;
  actor: "visitor" | "system" | "admin";
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  latency_ms: number;
  cost_usd: number;
  ok: boolean;
  error_code?: string | null;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("lab_ai_calls").insert(row);
  if (error) console.error(JSON.stringify({ level: "error", src: "lab", event: "ai_call_log_failed", error: error.message }));
}

// ---- Magic links -----------------------------------------------------------

export async function insertMagicLink(row: {
  token_hash: string;
  email: string;
  purpose: "resume" | "delete";
  expires_at: string;
  created_ip_hash?: string | null;
}): Promise<void> {
  const { error } = await db().from("lab_magic_links").insert(row);
  if (error) throw new LabStoreError("insertMagicLink", error.message);
}

export async function consumeMagicLinkRow(tokenHash: string, purpose: "resume" | "delete"): Promise<{ email: string } | null> {
  // Single use: only the first UPDATE that sees used_at IS NULL wins.
  const { data, error } = await db()
    .from("lab_magic_links")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("email")
    .maybeSingle();
  if (error) throw new LabStoreError("consumeMagicLink", error.message);
  return (data as { email: string } | null) ?? null;
}

export async function peekMagicLink(tokenHash: string, purpose: "resume" | "delete"): Promise<boolean> {
  const { data } = await db()
    .from("lab_magic_links")
    .select("id")
    .eq("token_hash", tokenHash)
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

// ---- Events ----------------------------------------------------------------

export async function insertEvent(row: {
  session_id: string | null;
  kind: string;
  level: "debug" | "info" | "warn" | "error";
  payload?: Record<string, unknown> | null;
  request_id?: string | null;
}): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  await supabase.from("lab_events").insert(row);
}

export async function hasEvent(sessionId: string, kind: string): Promise<boolean> {
  const { data } = await db()
    .from("lab_events")
    .select("id")
    .eq("session_id", sessionId)
    .eq("kind", kind)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// ---- Deletion --------------------------------------------------------------

export async function deleteVisitorData(visitorId: string): Promise<number> {
  const sessions = await listSessionsForVisitor(visitorId);
  // Cascades remove messages, state, briefs, assessments, decisions, notes.
  const { error } = await db().from("lab_visitors").delete().eq("id", visitorId);
  if (error) throw new LabStoreError("deleteVisitorData", error.message);
  return sessions.length;
}

export async function recordDeletionRequest(row: {
  email_hash: string;
  confirmed_at?: string | null;
  sessions_deleted?: number | null;
}): Promise<void> {
  await db().from("lab_deletion_requests").insert(row);
}
