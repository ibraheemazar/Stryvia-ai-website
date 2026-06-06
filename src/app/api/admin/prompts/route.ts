import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";
import { classifyPrompt } from "@/lib/prompts/ai";
import { extractVariables } from "@/lib/prompts/vars";
import type { Prompt } from "@/lib/prompts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLUMNS = "id,title,body,category,tags,variables,favorite,use_count,created_at,updated_at";

// GET /api/admin/prompts?q=&category=
// Lists the library, newest-edited first, with optional keyword/phrase search
// across title + body and an optional category filter.
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const svc = requireService();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category")?.trim();

  let query = svc.from("prompts").select(COLUMNS).order("updated_at", { ascending: false }).limit(500);
  if (category) query = query.eq("category", category);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prompts: (data ?? []) as Prompt[] });
}

// POST /api/admin/prompts  { title?, body, classify? }
// Creates a prompt. By default AI assigns title/category/tags and may improve
// the body; pass classify:false to save verbatim.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text: string = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  let title: string = typeof body?.title === "string" ? body.title.trim() : "";
  let category: string | null = typeof body?.category === "string" ? body.category.trim() : null;
  let tags: string[] = Array.isArray(body?.tags) ? body.tags : [];
  let finalBody = text;

  if (body?.classify !== false) {
    const c = await classifyPrompt(text, { improve: body?.improve !== false });
    if (c) {
      if (!title) title = c.title;
      if (!category) category = c.category;
      if (tags.length === 0) tags = c.tags;
      if (c.improved && body?.improve !== false) finalBody = c.improved;
    }
  }
  if (!title) title = finalBody.split("\n")[0].slice(0, 60) || "Untitled prompt";

  const svc = requireService();
  const { data, error } = await svc
    .from("prompts")
    .insert({ title, body: finalBody, category, tags, variables: extractVariables(finalBody) })
    .select(COLUMNS)
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prompt: data as Prompt });
}

// PATCH /api/admin/prompts  { id, title?, body?, category?, tags?, favorite?, bump? }
// Updates a prompt. `bump` increments the copy/use counter on one-click copy.
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id: string = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "no_id" }, { status: 400 });

  const svc = requireService();

  if (body?.bump === true) {
    const { data: cur } = await svc.from("prompts").select("use_count").eq("id", id).single();
    const { data, error } = await svc
      .from("prompts")
      .update({ use_count: (cur?.use_count ?? 0) + 1 })
      .eq("id", id)
      .select(COLUMNS)
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, prompt: data as Prompt });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") patch.title = body.title.trim();
  if (typeof body?.body === "string") {
    patch.body = body.body;
    patch.variables = extractVariables(body.body);
  }
  if (typeof body?.category === "string") patch.category = body.category.trim() || null;
  if (Array.isArray(body?.tags)) patch.tags = body.tags;
  if (typeof body?.favorite === "boolean") patch.favorite = body.favorite;

  const { data, error } = await svc.from("prompts").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prompt: data as Prompt });
}

// DELETE /api/admin/prompts?id=
export async function DELETE(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "no_id" }, { status: 400 });

  const svc = requireService();
  const { error } = await svc.from("prompts").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
