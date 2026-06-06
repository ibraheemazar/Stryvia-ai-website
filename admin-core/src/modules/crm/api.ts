import "server-only";
import { requireService } from "../../auth/supabase-server";
import type { ConversationRow, CrmInsights } from "./types";

// Server-side data layer for the CRM module. The host app mounts this from a
// route handler at GET /api/admin/crm/data, after verifyAdmin() passes:
//
//   export async function GET(req: NextRequest) {
//     const auth = await verifyAdmin(req.headers.get("authorization"));
//     if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });
//     const url = new URL(req.url);
//     return NextResponse.json(await getCrmData({
//       view: url.searchParams.get("view") ?? "inbox",
//       q: url.searchParams.get("q"),
//       status: url.searchParams.get("status"),
//     }));
//   }

type Params = { view?: string; q?: string | null; status?: string | null };

// A lightweight, transparent lead score from the conversation shape. Replace
// with your own model if you have one — the dashboard just reads `score`.
function scoreConversation(c: {
  converted: boolean;
  status: string;
  problem_category: string | null;
  summary: string | null;
}): number {
  let score = 0;
  if (c.converted) score += 50;
  if (c.status === "scoped") score += 20;
  if (c.status === "escalated") score += 25;
  if (c.problem_category) score += 15;
  if (c.summary && c.summary.length > 40) score += 10;
  return Math.min(100, score);
}

export async function getCrmData(params: Params): Promise<{
  ok: boolean;
  insights: CrmInsights;
  conversations: ConversationRow[];
}> {
  const svc = requireService();
  const view = params.view === "all" ? "all" : "inbox";

  // Base conversation query.
  let query = svc
    .from("conversations")
    .select(
      "id, created_at, updated_at, locale, page_context, status, problem_category, summary, converted",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (view === "inbox") query = query.eq("converted", true);
  if (params.status) query = query.eq("status", params.status);

  // Full-text transcript search: find matching conversation ids first.
  if (params.q) {
    const { data: hits } = await svc
      .from("messages")
      .select("conversation_id")
      .textSearch("content_tsv", params.q, { type: "websearch", config: "simple" })
      .limit(500);
    const ids = [...new Set((hits ?? []).map((h) => h.conversation_id))];
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: convos } = await query;
  const rows = convos ?? [];

  // Attach leads.
  const ids = rows.map((r) => r.id);
  const { data: leads } = ids.length
    ? await svc
        .from("leads")
        .select("conversation_id, name, email, company, status")
        .in("conversation_id", ids)
    : { data: [] as Array<{ conversation_id: string; name: string; email: string; company: string | null; status: string }> };

  const leadByConvo = new Map((leads ?? []).map((l) => [l.conversation_id, l]));

  const conversations: ConversationRow[] = rows.map((r) => ({
    ...r,
    score: scoreConversation(r),
    lead: leadByConvo.get(r.id)
      ? {
          name: leadByConvo.get(r.id)!.name,
          email: leadByConvo.get(r.id)!.email,
          company: leadByConvo.get(r.id)!.company,
          status: leadByConvo.get(r.id)!.status,
        }
      : null,
  }));

  // Insights over the full corpus (not just the filtered page).
  const { data: all } = await svc
    .from("conversations")
    .select("status, problem_category, converted");
  const corpus = all ?? [];
  const total = corpus.length;
  const converted = corpus.filter((c) => c.converted).length;
  const categoryCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const c of corpus) {
    if (c.problem_category) categoryCounts[c.problem_category] = (categoryCounts[c.problem_category] || 0) + 1;
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  }

  return {
    ok: true,
    insights: {
      total,
      converted,
      conversionRate: total ? Math.round((converted / total) * 100) : 0,
      categoryCounts,
      statusCounts,
    },
    conversations,
  };
}
