import "server-only";
import { getServiceSupabase } from "@/lib/supabase";
import type { LabAssessmentRow } from "./assessor";
import { getLatestAssessment } from "./assessor";
import { labEvent } from "./events";
import {
  bumpVisitorGeneration,
  getLatestBrief,
  getSessionById,
  getState,
  listMessages,
  type LabBriefRow,
  type LabMessageRow,
  type LabSessionRow,
  type LabStateRow,
} from "./store";

// Admin-side queries (brief §8). Only reachable from /api/admin/lab/* behind
// `verifyAdmin`. Everything here uses the service role.

function db() {
  const s = getServiceSupabase();
  if (!s) throw new Error("Supabase service role is not configured.");
  return s;
}

export type LabDecisionRow = {
  id: string;
  session_id: string;
  decision: "book_call" | "request_quote" | "decline" | "hold";
  notes: string | null;
  decided_by: string;
  decided_at: string;
  outbound_email_subject: string | null;
  outbound_email_body: string | null;
  outbound_email_sent_at: string | null;
};

export type LabNoteRow = { id: string; session_id: string; author: string; body: string; created_at: string };

export type ListFilters = {
  verdict?: string;
  language?: string;
  status?: string;
  industry?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
};

export type ListRow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  status: string;
  phase: string;
  language: string;
  visitor_name: string;
  email: string;
  phone_e164: string;
  company: string | null;
  role: string | null;
  country: string;
  turn_count: number;
  cost_usd: number;
  industry: string | null;
  verdict: string | null;
  weighted_score: number | null;
  assessment_status: string;
  has_decision: boolean;
  /** Latest decision kind, when one exists. */
  decision: string | null;
  awaiting_decision: boolean;
};

export async function listSessions(f: ListFilters): Promise<ListRow[]> {
  let q = db()
    .from("lab_sessions")
    .select("id, created_at, submitted_at, status, phase, language, visitor_name, email, phone_e164, company, role, country, turn_count, token_usage, assessment_status")
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(Math.min(f.limit ?? 200, 500));
  if (f.status) q = q.eq("status", f.status);
  if (f.language) q = q.eq("language", f.language);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lt("created_at", f.to);
  if (f.q) q = q.or(`visitor_name.ilike.%${f.q}%,email.ilike.%${f.q}%,company.ilike.%${f.q}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const sessions = (data ?? []) as Array<Pick<LabSessionRow, "id" | "created_at" | "submitted_at" | "status" | "phase" | "language" | "visitor_name" | "email" | "phone_e164" | "company" | "role" | "country" | "turn_count" | "token_usage" | "assessment_status">>;
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);

  const [{ data: states }, { data: assessments }, { data: decisions }] = await Promise.all([
    db().from("lab_idea_state").select("session_id, slots").in("session_id", ids),
    db().from("lab_assessments").select("session_id, verdict, weighted_score, created_at").in("session_id", ids).order("created_at", { ascending: false }),
    db().from("lab_decisions").select("session_id, decision, decided_at").in("session_id", ids).order("decided_at", { ascending: false }),
  ]);
  const industryBy = new Map<string, string | null>();
  for (const s of (states ?? []) as Array<{ session_id: string; slots: { industry?: { value?: string } } }>) {
    industryBy.set(s.session_id, s.slots?.industry?.value ?? null);
  }
  const latestAssessment = new Map<string, { verdict: string; weighted_score: number }>();
  for (const a of (assessments ?? []) as Array<{ session_id: string; verdict: string; weighted_score: number }>) {
    if (!latestAssessment.has(a.session_id)) latestAssessment.set(a.session_id, a);
  }
  const latestDecision = new Map<string, string>();
  for (const d of (decisions ?? []) as Array<{ session_id: string; decision: string }>) {
    if (!latestDecision.has(d.session_id)) latestDecision.set(d.session_id, d.decision);
  }

  let rows: ListRow[] = sessions.map((s) => {
    const a = latestAssessment.get(s.id);
    return {
      id: s.id,
      created_at: s.created_at,
      submitted_at: s.submitted_at,
      status: s.status,
      phase: s.phase,
      language: s.language,
      visitor_name: s.visitor_name,
      email: s.email,
      phone_e164: s.phone_e164,
      company: s.company,
      role: s.role,
      country: s.country,
      turn_count: s.turn_count,
      cost_usd: Number(s.token_usage?.cost_usd ?? 0),
      industry: industryBy.get(s.id) ?? null,
      verdict: a?.verdict ?? null,
      weighted_score: a ? Number(a.weighted_score) : null,
      assessment_status: s.assessment_status,
      has_decision: latestDecision.has(s.id),
      decision: latestDecision.get(s.id) ?? null,
      awaiting_decision: s.status === "submitted" && !latestDecision.has(s.id),
    };
  });
  if (f.verdict) rows = rows.filter((r) => r.verdict === f.verdict);
  if (f.industry) rows = rows.filter((r) => (r.industry ?? "").toLowerCase().includes(f.industry!.toLowerCase()));
  // Sorted by score (§8), unscored/in-progress last, then newest first.
  rows.sort((a, b) => (b.weighted_score ?? -1) - (a.weighted_score ?? -1) || b.created_at.localeCompare(a.created_at));
  return rows;
}

export type SessionDetail = {
  session: LabSessionRow;
  messages: LabMessageRow[];
  state: LabStateRow;
  brief: LabBriefRow | null;
  assessment: LabAssessmentRow | null;
  assessments: LabAssessmentRow[];
  decisions: LabDecisionRow[];
  notes: LabNoteRow[];
};

export async function getSessionDetail(id: string): Promise<SessionDetail | null> {
  const session = await getSessionById(id);
  if (!session || session.status === "deleted") return null;
  const [messages, state, brief, assessment, assessmentsRes, decisionsRes, notesRes] = await Promise.all([
    listMessages(id),
    getState(id),
    getLatestBrief(id),
    getLatestAssessment(id),
    db().from("lab_assessments").select("*").eq("session_id", id).order("created_at", { ascending: false }),
    db().from("lab_decisions").select("*").eq("session_id", id).order("decided_at", { ascending: false }),
    db().from("lab_admin_notes").select("*").eq("session_id", id).order("created_at", { ascending: false }),
  ]);
  return {
    session,
    messages,
    state,
    brief,
    assessment,
    assessments: (assessmentsRes.data ?? []) as LabAssessmentRow[],
    decisions: (decisionsRes.data ?? []) as LabDecisionRow[],
    notes: (notesRes.data ?? []) as LabNoteRow[],
  };
}

export async function addNote(sessionId: string, author: string, body: string): Promise<LabNoteRow> {
  const { data, error } = await db().from("lab_admin_notes").insert({ session_id: sessionId, author, body }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "note insert failed");
  return data as LabNoteRow;
}

export async function recordDecision(row: {
  session_id: string;
  decision: LabDecisionRow["decision"];
  notes?: string | null;
  decided_by: string;
  outbound_email_subject?: string | null;
  outbound_email_body?: string | null;
  outbound_email_sent_at?: string | null;
}): Promise<LabDecisionRow> {
  const { data, error } = await db().from("lab_decisions").insert(row).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "decision insert failed");
  const status = row.decision === "hold" ? "reviewed" : row.decision === "decline" ? "closed" : "reviewed";
  await db().from("lab_sessions").update({ status }).eq("id", row.session_id).neq("status", "deleted");
  await labEvent("decision.recorded", "info", { sessionId: row.session_id, payload: { kind: row.decision, actor: "admin" } });
  return data as LabDecisionRow;
}

export async function adminDeleteSession(sessionId: string): Promise<boolean> {
  const session = await getSessionById(sessionId);
  if (!session) return false;
  await bumpVisitorGeneration(session.visitor_id);
  const { error } = await db().from("lab_sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
  await labEvent("session.admin_deleted", "info", { sessionId: null, payload: { actor: "admin" } });
  return true;
}

export async function getStats(from: Date, to: Date): Promise<Record<string, unknown>> {
  const { data, error } = await db().rpc("lab_stats", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>) ?? {};
}

export async function listIndustries(): Promise<string[]> {
  const { data } = await db().from("lab_idea_state").select("slots").limit(1000);
  const set = new Set<string>();
  for (const s of (data ?? []) as Array<{ slots: { industry?: { value?: string } } }>) {
    const v = s.slots?.industry?.value?.trim();
    if (v) set.add(v);
  }
  return [...set].sort();
}
