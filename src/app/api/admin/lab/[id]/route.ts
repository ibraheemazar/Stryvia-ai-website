import type { NextRequest } from "next/server";
import { adminDeleteSession, getSessionDetail } from "@/lib/lab/admin";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminLabRoute<{ id: string }>("admin.lab.detail", async (_req: NextRequest, { params }) => {
  const detail = await getSessionDetail(params.id);
  if (!detail) return adminJson({ ok: false, error: "not_found" }, 404);
  return adminJson({ ok: true, ...detail });
});

// Hard delete (admin). Cascades to messages, state, briefs, assessments,
// decisions and notes; revokes the visitor's cookies.
export const DELETE = withAdminLabRoute<{ id: string }>("admin.lab.delete", async (_req: NextRequest, { params }) => {
  const ok = await adminDeleteSession(params.id);
  return adminJson({ ok }, ok ? 200 : 404);
});
