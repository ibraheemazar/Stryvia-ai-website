import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { getLabSettings } from "./env";
import { labEvent } from "./events";
import { labLog, newRequestId } from "./log";
import { requireSessionOwner, type OwnerCheck } from "./session-auth";
import { TurnBusyError } from "./engine";
import { LabAiError } from "./ai";

// Shared plumbing for every Lab route: request id, feature switch, JSON
// parsing with zod, and one error path that logs and never leaks internals.

export type LabCtx = { requestId: string; route: string };

export function json(data: unknown, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function labDisabledResponse(): NextResponse {
  return json({ ok: false, error: "lab_disabled" }, 503);
}

export async function readJson<T>(req: NextRequest, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: json({ ok: false, error: "invalid_json" }, 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      res: json({ ok: false, error: "invalid_input", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400),
    };
  }
  return { ok: true, data: parsed.data };
}

type Handler<P> = (req: NextRequest, ctx: LabCtx & { params: P }) => Promise<Response>;

/** Wrap a route handler with the Lab's request lifecycle. */
export function withLabRoute<P = Record<string, never>>(route: string, handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? newRequestId();
    const started = Date.now();
    const settings = getLabSettings();
    if (!settings.enabled) {
      labLog("warn", "lab.disabled_request", { request_id: requestId, route, reason: settings.disabledReason });
      return labDisabledResponse();
    }
    try {
      const params = await context.params;
      const res = await handler(req, { requestId, route, params });
      labLog("info", "lab.request", { request_id: requestId, route, status: res.status, duration_ms: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof TurnBusyError) return json({ ok: false, error: "busy" }, 409);
      if (err instanceof LabAiError) {
        await labEvent("route.ai_error", "error", { requestId, payload: { code: err.code, error: err.message } });
        const status = err.code === "rate_limited" ? 429 : err.code === "not_configured" ? 503 : 502;
        return json({ ok: false, error: "ai_unavailable", code: err.code }, status);
      }
      await labEvent("route.error", "error", {
        requestId,
        payload: { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      });
      return json({ ok: false, error: "internal" }, 500);
    }
  };
}

/** Resolve the owner check into either a session or the right error response. */
export async function ownerOr(req: NextRequest, sessionId: string): Promise<OwnerCheck & { res?: NextResponse }> {
  const check = await requireSessionOwner(req, sessionId);
  if (check.ok) return check;
  return { ...check, res: json({ ok: false, error: check.reason }, check.status) };
}

/** Build a locale-aware absolute URL under the site (en has no prefix). */
export function labUrl(path: string, language: "en" | "ar", siteUrl = getLabSettings().siteUrl): string {
  const prefix = language === "ar" ? "/ar" : "";
  return `${siteUrl}${prefix}${path}`;
}
