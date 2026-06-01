import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { getMarketingOverview, getConversationIntelligence } from "@/lib/marketing/data";
import { seedIntegrations, resolveSegmentLeads } from "@/lib/marketing/actions";
import { providerConfigured } from "@/lib/marketing/connectors";
import { getPerformance } from "@/lib/marketing/performance";
import { INTEGRATIONS } from "@/lib/marketing/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const svc = requireService();
  const section = new URL(req.url).searchParams.get("section") || "home";

  if (section === "home") {
    await seedIntegrations();
    const [overview, intelligence, { data: integrations }, { data: insights }] = await Promise.all([
      getMarketingOverview(),
      getConversationIntelligence(),
      svc.from("marketing_integrations").select("*"),
      svc
        .from("marketing_insights")
        .select("*")
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const envConfigured = Object.fromEntries(
      INTEGRATIONS.map((i) => [i.provider, providerConfigured(i.provider)]),
    );
    return NextResponse.json({ ok: true, overview, intelligence, integrations, insights, envConfigured });
  }

  if (section === "content") {
    const { data } = await svc
      .from("marketing_content")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ ok: true, content: data ?? [] });
  }

  if (section === "segments") {
    const { data } = await svc
      .from("marketing_segments")
      .select("*")
      .order("created_at", { ascending: false });
    // attach live audience counts
    const withCounts = await Promise.all(
      (data ?? []).map(async (s) => ({
        ...s,
        count: (await resolveSegmentLeads(s.rules || {})).length,
      })),
    );
    return NextResponse.json({ ok: true, segments: withCounts });
  }

  if (section === "automations") {
    const [{ data: automations }, { data: runs }] = await Promise.all([
      svc.from("marketing_automations").select("*").order("created_at", { ascending: false }),
      svc
        .from("marketing_automation_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    return NextResponse.json({ ok: true, automations: automations ?? [], runs: runs ?? [] });
  }

  if (section === "performance") {
    const channels = await getPerformance();
    return NextResponse.json({ ok: true, channels });
  }

  if (section === "campaigns") {
    const { data } = await svc
      .from("marketing_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ ok: true, campaigns: data ?? [] });
  }

  return NextResponse.json({ ok: false, reason: "unknown_section" }, { status: 400 });
}
