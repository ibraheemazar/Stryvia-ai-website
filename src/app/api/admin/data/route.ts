import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { scoreConversation } from "@/lib/marketing/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the dashboard payload: Insights metrics + a filtered conversation
// list (Decisions §5). Auth-gated; data is read with the service role only
// after the caller's token and allowlist are verified.
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });
  }

  const svc = requireService();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const locale = url.searchParams.get("locale");
  const view = url.searchParams.get("view") || "all"; // all | inbox
  const search = url.searchParams.get("q")?.trim();

  // ---- Insights ----
  const [{ count: total }, { count: converted }, { data: categories }, { data: statuses }] =
    await Promise.all([
      svc.from("conversations").select("*", { count: "exact", head: true }),
      svc
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("converted", true),
      svc.from("conversations").select("problem_category"),
      svc.from("conversations").select("status"),
    ]);

  const categoryCounts: Record<string, number> = {};
  (categories ?? []).forEach((r: { problem_category: string | null }) => {
    const k = r.problem_category || "uncategorized";
    categoryCounts[k] = (categoryCounts[k] || 0) + 1;
  });
  const statusCounts: Record<string, number> = {};
  (statuses ?? []).forEach((r: { status: string }) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  // ---- Conversation list ----
  let convIds: string[] | null = null;
  if (search) {
    const { data: hits } = await svc
      .from("messages")
      .select("conversation_id")
      .textSearch("content_tsv", search, { type: "websearch", config: "simple" })
      .limit(500);
    convIds = Array.from(new Set((hits ?? []).map((h) => h.conversation_id)));
    if (convIds.length === 0) convIds = ["00000000-0000-0000-0000-000000000000"];
  }

  let q = svc
    .from("conversations")
    .select("id, created_at, updated_at, locale, page_context, status, problem_category, summary, converted, analysis")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (view === "inbox") q = q.eq("converted", true);
  if (status) q = q.eq("status", status);
  if (category) q = q.eq("problem_category", category);
  if (locale) q = q.eq("locale", locale);
  if (convIds) q = q.in("id", convIds);

  const { data: conversations, error: listError } = await q;
  if (listError) {
    console.error("[stryvia] admin data list query failed:", listError);
    return NextResponse.json(
      { ok: false, reason: "query_failed" },
      { status: 500 },
    );
  }

  // attach leads for the converted ones
  const ids = (conversations ?? []).filter((c) => c.converted).map((c) => c.id);
  let leadsByConv: Record<string, unknown> = {};
  if (ids.length > 0) {
    const { data: leads } = await svc.from("leads").select("*").in("conversation_id", ids);
    leadsByConv = Object.fromEntries((leads ?? []).map((l) => [l.conversation_id, l]));
  }

  return NextResponse.json({
    ok: true,
    insights: {
      total: total ?? 0,
      converted: converted ?? 0,
      conversionRate: total ? Math.round(((converted ?? 0) / total) * 1000) / 10 : 0,
      categoryCounts,
      statusCounts,
    },
    conversations: (conversations ?? []).map((c) => {
      const score = scoreConversation(c as Parameters<typeof scoreConversation>[0]);
      const row = { ...c } as Record<string, unknown>;
      delete row.analysis; // keep the list payload lean; full analysis is on the detail route
      return { ...row, lead: leadsByConv[c.id] ?? null, score };
    }),
  });
}
