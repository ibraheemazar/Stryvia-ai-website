import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { LAB_LIMITS } from "@/config/lab.config";
import { getLabSettings } from "./env";
import { getSessionById, getVisitorById, type LabSessionRow } from "./store";

// Visitor identity for the Lab (plan decision 1). A signed, HttpOnly cookie
// carries the visitor id and a generation counter; a magic link is the only
// way to obtain the cookie on a new device. This module is the single
// chokepoint for ownership checks — every visitor route must call
// `requireSessionOwner` first (enforced by a repo-guard test).

export const LAB_COOKIE = "sv_lab";

export type VisitorCookie = { vid: string; gen: number; exp: number };

function secret(): string {
  const s = getLabSettings().cookieSecret;
  if (!s) throw new Error("Lab cookie secret is not configured.");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, key = secret()): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function encodeVisitorCookie(c: VisitorCookie, key?: string): string {
  const payload = b64url(JSON.stringify(c));
  return `${payload}.${sign(payload, key)}`;
}

export function decodeVisitorCookie(value: string | undefined | null, key?: string): VisitorCookie | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(payload, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<VisitorCookie>;
    if (
      typeof parsed.vid !== "string" ||
      typeof parsed.gen !== "number" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return { vid: parsed.vid, gen: parsed.gen, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: LAB_LIMITS.cookieTtlDays * 24 * 60 * 60,
  };
}

export function buildVisitorCookie(vid: string, gen: number): { name: string; value: string; options: ReturnType<typeof cookieOptions> } {
  const exp = Date.now() + LAB_LIMITS.cookieTtlDays * 24 * 60 * 60 * 1000;
  return { name: LAB_COOKIE, value: encodeVisitorCookie({ vid, gen, exp }), options: cookieOptions() };
}

export type OwnerCheck =
  | { ok: true; session: LabSessionRow; visitorId: string }
  | { ok: false; status: 401 | 404; reason: "no_cookie" | "bad_cookie" | "not_found" | "revoked" };

/** Verify the request cookie and that the session belongs to that visitor. */
export async function requireSessionOwner(req: NextRequest, sessionId: string): Promise<OwnerCheck> {
  const raw = req.cookies.get(LAB_COOKIE)?.value;
  if (!raw) return { ok: false, status: 401, reason: "no_cookie" };
  const cookie = decodeVisitorCookie(raw);
  if (!cookie) return { ok: false, status: 401, reason: "bad_cookie" };

  const session = await getSessionById(sessionId);
  // 404 for both "no such session" and "not yours": never confirm existence.
  if (!session || session.visitor_id !== cookie.vid || session.status === "deleted") {
    return { ok: false, status: 404, reason: "not_found" };
  }
  const visitor = await getVisitorById(cookie.vid);
  if (!visitor || visitor.cookie_generation !== cookie.gen) {
    return { ok: false, status: 401, reason: "revoked" };
  }
  return { ok: true, session, visitorId: cookie.vid };
}

/** Read the visitor from the cookie only (no session), for listing/resume. */
export async function readVisitor(req: NextRequest): Promise<{ vid: string } | null> {
  const cookie = decodeVisitorCookie(req.cookies.get(LAB_COOKIE)?.value);
  if (!cookie) return null;
  const visitor = await getVisitorById(cookie.vid);
  if (!visitor || visitor.cookie_generation !== cookie.gen) return null;
  return { vid: cookie.vid };
}
