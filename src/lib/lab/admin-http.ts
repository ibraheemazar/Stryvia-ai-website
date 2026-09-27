import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getLabSettings } from "./env";
import { labEvent } from "./events";
import { labLog, newRequestId } from "./log";
import { LabAiError } from "./ai";

// Admin route plumbing: the existing `verifyAdmin` Bearer check (Supabase OTP +
// email allowlist) plus the Lab's request lifecycle. Assessments never leave
// this surface.

type Handler<P> = (req: NextRequest, ctx: { requestId: string; params: P; admin: string }) => Promise<Response>;

export function withAdminLabRoute<P = Record<string, never>>(route: string, handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const requestId = newRequestId();
    const auth = await verifyAdmin(req.headers.get("authorization"));
    if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });
    const settings = getLabSettings();
    if (!settings.enabled && !route.startsWith("admin.lab.list")) {
      // Admin can still read data while the visitor side is off; AI actions are refused.
    }
    const started = Date.now();
    try {
      const params = await context.params;
      const res = await handler(req, { requestId, params, admin: auth.email! });
      labLog("info", "lab.admin_request", { request_id: requestId, route, status: res.status, duration_ms: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof LabAiError) {
        return NextResponse.json({ ok: false, error: "ai_unavailable", code: err.code }, { status: 502 });
      }
      await labEvent("admin_route.error", "error", { requestId, payload: { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err), actor: "admin" } });
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }
  };
}

/**
 * Who may record or communicate a decision: every allowlisted admin, unless
 * the owner narrowed it with LAB_REVIEWER_EMAILS. Server-side only.
 */
export function canDecide(adminEmail: string): boolean {
  const list = getLabSettings().reviewerEmails;
  return list.length === 0 || list.includes(adminEmail.toLowerCase());
}

export function adminJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
