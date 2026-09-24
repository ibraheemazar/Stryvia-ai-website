import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the store so ownership checks run without a database.
const visitors = new Map<string, { id: string; cookie_generation: number }>();
const sessions = new Map<string, { id: string; visitor_id: string; status: string }>();
vi.mock("@/lib/lab/store", () => ({
  getSessionById: async (id: string) => sessions.get(id) ?? null,
  getVisitorById: async (id: string) => visitors.get(id) ?? null,
}));

import { NextRequest } from "next/server";
import { LAB_COOKIE, decodeVisitorCookie, encodeVisitorCookie, requireSessionOwner } from "@/lib/lab/session-auth";

function req(cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${LAB_COOKIE}=${cookie}`);
  return new NextRequest("https://stryvia.ai/api/lab/session/x", { headers });
}

const future = Date.now() + 60_000;

describe("visitor cookie", () => {
  beforeEach(() => {
    visitors.clear();
    sessions.clear();
    visitors.set("v1", { id: "v1", cookie_generation: 1 });
    visitors.set("v2", { id: "v2", cookie_generation: 1 });
    sessions.set("s1", { id: "s1", visitor_id: "v1", status: "in_progress" });
    sessions.set("s2", { id: "s2", visitor_id: "v2", status: "in_progress" });
  });

  it("round-trips and rejects tampering, bad signatures and expiry", () => {
    const c = encodeVisitorCookie({ vid: "v1", gen: 1, exp: future });
    expect(decodeVisitorCookie(c)).toEqual({ vid: "v1", gen: 1, exp: future });
    const [payload, sig] = c.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ vid: "v2", gen: 1, exp: future })).toString("base64url")}.${sig}`;
    expect(decodeVisitorCookie(tampered)).toBeNull();
    expect(decodeVisitorCookie(`${payload}.AAAA`)).toBeNull();
    expect(decodeVisitorCookie(encodeVisitorCookie({ vid: "v1", gen: 1, exp: Date.now() - 1 }))).toBeNull();
    expect(decodeVisitorCookie("garbage")).toBeNull();
    expect(decodeVisitorCookie(undefined)).toBeNull();
    expect(decodeVisitorCookie(encodeVisitorCookie({ vid: "v1", gen: 1, exp: future }, "other-secret"))).toBeNull();
  });

  it("allows the owner and denies everyone else with 404 (no existence leak)", async () => {
    const mine = encodeVisitorCookie({ vid: "v1", gen: 1, exp: future });
    const ok = await requireSessionOwner(req(mine), "s1");
    expect(ok.ok).toBe(true);
    const cross = await requireSessionOwner(req(mine), "s2");
    expect(cross).toMatchObject({ ok: false, status: 404 });
    const missing = await requireSessionOwner(req(mine), "does-not-exist");
    expect(missing).toMatchObject({ ok: false, status: 404 });
  });

  it("denies without a cookie and after a generation bump (revocation)", async () => {
    expect(await requireSessionOwner(req(), "s1")).toMatchObject({ ok: false, status: 401, reason: "no_cookie" });
    const old = encodeVisitorCookie({ vid: "v1", gen: 1, exp: future });
    visitors.set("v1", { id: "v1", cookie_generation: 2 });
    expect(await requireSessionOwner(req(old), "s1")).toMatchObject({ ok: false, status: 401, reason: "revoked" });
  });

  it("treats deleted sessions as not found", async () => {
    sessions.set("s1", { id: "s1", visitor_id: "v1", status: "deleted" });
    const mine = encodeVisitorCookie({ vid: "v1", gen: 1, exp: future });
    expect(await requireSessionOwner(req(mine), "s1")).toMatchObject({ ok: false, status: 404 });
  });
});
