import "server-only";
import { getServiceSupabase } from "@/lib/supabase";

// Real first-party marketing metrics computed from the data Stryvia already
// owns: conversations, leads, and first-touch attribution. No fabricated
// numbers — everything here reflects actual activity.

export type Overview = {
  totals: {
    conversations: number;
    leads: number;
    converted: number;
    conversionRate: number;
    last7Leads: number;
    last7Conversations: number;
  };
  funnel: { label: string; value: number }[];
  byCategory: { category: string; conversations: number; converted: number }[];
  byLocale: { locale: string; count: number }[];
  bySource: { source: string; conversations: number; converted: number }[];
  trend: { day: string; conversations: number; leads: number }[];
};

function dayKey(d: string) {
  return new Date(d).toISOString().slice(0, 10);
}

export async function getMarketingOverview(): Promise<Overview | null> {
  const svc = getServiceSupabase();
  if (!svc) return null;

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const since7 = Date.now() - 7 * 86400000;

  const [{ data: convs }, { data: leads }] = await Promise.all([
    svc
      .from("conversations")
      .select("id, created_at, locale, status, problem_category, converted, utm_source")
      .gte("created_at", since)
      .limit(5000),
    svc.from("leads").select("id, created_at, status").gte("created_at", since).limit(5000),
  ]);

  const C = convs ?? [];
  const L = leads ?? [];

  const converted = C.filter((c) => c.converted).length;
  const scoped = C.filter((c) => c.status === "scoped" || c.status === "converted").length;
  const firstMsg = C.length; // every stored conversation has a first message

  const cat: Record<string, { conversations: number; converted: number }> = {};
  const loc: Record<string, number> = {};
  const src: Record<string, { conversations: number; converted: number }> = {};
  const trendMap: Record<string, { conversations: number; leads: number }> = {};

  for (const c of C) {
    const k = c.problem_category || "uncategorized";
    cat[k] ??= { conversations: 0, converted: 0 };
    cat[k].conversations++;
    if (c.converted) cat[k].converted++;

    loc[c.locale || "en"] = (loc[c.locale || "en"] || 0) + 1;

    const s = c.utm_source || "direct";
    src[s] ??= { conversations: 0, converted: 0 };
    src[s].conversations++;
    if (c.converted) src[s].converted++;

    const d = dayKey(c.created_at);
    trendMap[d] ??= { conversations: 0, leads: 0 };
    trendMap[d].conversations++;
  }
  for (const l of L) {
    const d = dayKey(l.created_at);
    trendMap[d] ??= { conversations: 0, leads: 0 };
    trendMap[d].leads++;
  }

  const trend = Object.entries(trendMap)
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-30);

  return {
    totals: {
      conversations: C.length,
      leads: L.length,
      converted,
      conversionRate: C.length ? Math.round((converted / C.length) * 1000) / 10 : 0,
      last7Leads: L.filter((l) => new Date(l.created_at).getTime() > since7).length,
      last7Conversations: C.filter((c) => new Date(c.created_at).getTime() > since7).length,
    },
    funnel: [
      { label: "Conversations", value: firstMsg },
      { label: "Scoped", value: scoped },
      { label: "Converted", value: converted },
    ],
    byCategory: Object.entries(cat)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.conversations - a.conversations),
    byLocale: Object.entries(loc).map(([locale, count]) => ({ locale, count })),
    bySource: Object.entries(src)
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.conversations - a.conversations),
    trend,
  };
}

// Conversation intelligence: the unique signal — what the market asks for.
export async function getConversationIntelligence(): Promise<{
  topCategories: { category: string; count: number; rate: number }[];
  recentAsks: { summary: string; category: string; locale: string; converted: boolean; created_at: string }[];
} | null> {
  const svc = getServiceSupabase();
  if (!svc) return null;

  const { data } = await svc
    .from("conversations")
    .select("summary, problem_category, locale, converted, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = data ?? [];
  const cat: Record<string, { count: number; converted: number }> = {};
  for (const r of rows) {
    const k = r.problem_category || "uncategorized";
    cat[k] ??= { count: 0, converted: 0 };
    cat[k].count++;
    if (r.converted) cat[k].converted++;
  }

  return {
    topCategories: Object.entries(cat)
      .map(([category, v]) => ({
        category,
        count: v.count,
        rate: v.count ? Math.round((v.converted / v.count) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    recentAsks: rows
      .filter((r) => r.summary)
      .slice(0, 30)
      .map((r) => ({
        summary: r.summary as string,
        category: r.problem_category || "uncategorized",
        locale: r.locale || "en",
        converted: !!r.converted,
        created_at: r.created_at as string,
      })),
  };
}
