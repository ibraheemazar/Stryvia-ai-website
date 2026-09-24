import type { NextRequest } from "next/server";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";
import { runAssessment } from "@/lib/lab/assessor";
import { getSessionById, updateSession } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Re-run the private assessment (brief §8). Debounced: one run at a time.
export const POST = withAdminLabRoute<{ id: string }>("admin.lab.assess", async (_req: NextRequest, { params }) => {
  const session = await getSessionById(params.id);
  if (!session || session.status === "deleted") return adminJson({ ok: false, error: "not_found" }, 404);
  if (session.assessment_status === "running") return adminJson({ ok: false, error: "running" }, 409);
  if (!session.submitted_at) await updateSession(session.id, { assessment_status: "pending" });
  const assessment = await runAssessment(session, "admin");
  return adminJson({ ok: true, assessment });
});
