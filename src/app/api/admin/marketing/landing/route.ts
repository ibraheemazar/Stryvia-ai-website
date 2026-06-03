import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { getResults, type LandingPage } from "@/lib/marketing/landing";
import { generateExperiment } from "@/lib/marketing/aiassist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const svc = requireService();
  const { data } = await svc
    .from("landing_pages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const pages = (data as LandingPage[]) ?? [];
  const withResults = await Promise.all(
    pages.map(async (p) => ({ ...p, results: await getResults(p) })),
  );
  return NextResponse.json({ ok: true, pages: withResults });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // AI: generate two distinct A/B variant angles + a test hypothesis.
  if (body.action === "ai_variants") {
    const out = await generateExperiment({
      goal: String(body.goal || ""),
      locale: body.locale ? String(body.locale) : "en",
      category: body.category ? String(body.category) : undefined,
    });
    if (!out) return NextResponse.json({ ok: false, reason: "generate_failed" }, { status: 200 });
    return NextResponse.json({ ok: true, ...out });
  }

  const svc = requireService();

  if (body.action === "create") {
    const slug = slugify(body.slug || body.name || "page");
    const variants = Array.isArray(body.variants) ? body.variants : [];
    const { error } = await svc.from("landing_pages").insert({
      slug,
      name: String(body.name || slug).slice(0, 200),
      locale: ["en", "ar", "fr"].includes(body.locale) ? body.locale : "en",
      goal: body.goal ? String(body.goal).slice(0, 200) : null,
      variants,
      status: "draft",
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slug });
  }

  if (body.action === "update" && body.id) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name) patch.name = String(body.name).slice(0, 200);
    if (body.goal !== undefined) patch.goal = body.goal ? String(body.goal).slice(0, 200) : null;
    if (Array.isArray(body.variants)) patch.variants = body.variants;
    await svc.from("landing_pages").update(patch).eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "status" && body.id) {
    const status = ["draft", "published", "archived"].includes(body.status) ? body.status : "draft";
    await svc.from("landing_pages").update({ status, updated_at: new Date().toISOString() }).eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    await svc.from("landing_pages").delete().eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
}
