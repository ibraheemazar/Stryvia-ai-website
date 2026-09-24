import type { NextRequest } from "next/server";
import { getStats, listIndustries, listSessions } from "@/lib/lab/admin";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List + stats for /supadmin/lab (brief §8).
export const GET = withAdminLabRoute("admin.lab.list", async (req: NextRequest) => {
  const p = req.nextUrl.searchParams;
  const days = Math.min(365, Math.max(1, Number(p.get("days") ?? 90)));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const [rows, stats, industries] = await Promise.all([
    listSessions({
      verdict: p.get("verdict") ?? undefined,
      language: p.get("language") ?? undefined,
      status: p.get("status") ?? undefined,
      industry: p.get("industry") ?? undefined,
      from: p.get("from") ?? undefined,
      to: p.get("to") ?? undefined,
      q: p.get("q")?.slice(0, 80) ?? undefined,
    }),
    getStats(from, to).catch(() => ({})),
    listIndustries().catch(() => []),
  ]);
  return adminJson({ ok: true, rows, stats, industries, window_days: days });
});
