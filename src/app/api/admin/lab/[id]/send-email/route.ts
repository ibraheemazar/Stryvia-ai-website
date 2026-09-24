import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";
import { sendDecisionEmail } from "@/lib/lab/decisions";
import { getSessionById } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  action: z.enum(["book_call", "request_quote", "decline"]),
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(10).max(6000),
  notes: z.string().trim().max(4000).optional().nullable(),
  language: z.enum(["en", "ar"]).optional(),
});

// The ONLY path that sends anything to a visitor after submission (§8 hard
// rule). Requires an explicit admin action with the final, edited text.
export const POST = withAdminLabRoute<{ id: string }>("admin.lab.send", async (req: NextRequest, { params, admin }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return adminJson({ ok: false, error: "invalid_input", issues: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  const session = await getSessionById(params.id);
  if (!session || session.status === "deleted") return adminJson({ ok: false, error: "not_found" }, 404);
  const { sent } = await sendDecisionEmail(session, { ...parsed.data, decidedBy: admin });
  return adminJson({ ok: true, sent });
});
