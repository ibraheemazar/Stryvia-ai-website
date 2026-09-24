import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";
import { draftDecisionEmail } from "@/lib/lab/decisions";
import { getSessionById } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({
  action: z.enum(["book_call", "request_quote", "decline"]),
  language: z.enum(["en", "ar"]).optional(),
  hint: z.string().trim().max(600).optional().nullable(),
});

// Pre-drafted email for the admin to edit (brief §8). Nothing is sent here.
export const POST = withAdminLabRoute<{ id: string }>("admin.lab.draft", async (req: NextRequest, { params }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return adminJson({ ok: false, error: "invalid_input" }, 400);
  const session = await getSessionById(params.id);
  if (!session || session.status === "deleted") return adminJson({ ok: false, error: "not_found" }, 404);
  const draft = await draftDecisionEmail(session, parsed.data.action, { language: parsed.data.language, adminHint: parsed.data.hint ?? null });
  return adminJson({ ok: true, draft });
});
