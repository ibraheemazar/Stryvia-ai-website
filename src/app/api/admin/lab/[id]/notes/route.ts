import type { NextRequest } from "next/server";
import { z } from "zod";
import { addNote } from "@/lib/lab/admin";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ body: z.string().trim().min(1).max(4000) });

export const POST = withAdminLabRoute<{ id: string }>("admin.lab.note", async (req: NextRequest, { params, admin }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return adminJson({ ok: false, error: "invalid_input" }, 400);
  const note = await addNote(params.id, admin, parsed.data.body);
  return adminJson({ ok: true, note });
});
