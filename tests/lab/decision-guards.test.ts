import { beforeEach, describe, expect, it, vi } from "vitest";

// Server-side manual-review controls (final-review spec, "Verify backend
// manual review"). These run the real admin route handlers with the auth,
// store and mail layers mocked, so the guards themselves are what is tested:
//   - no token → 401, nothing recorded
//   - an allowlisted admin who is not an authorised reviewer → 403
//   - a call without explicit confirmation → 400
//   - a session still in progress → 409
//   - preview never sends; send needs confirmation; no-contact blocks sends
//   - decisions are audited with the reviewer's identity

const auth = { ok: true as boolean, email: "owner@stryvia.ai" as string | undefined, reason: undefined as string | undefined };
vi.mock("@/lib/admin-auth", () => ({ verifyAdmin: async () => ({ ...auth }) }));

const settings = { reviewerEmails: [] as string[], enabled: true, schedulingUrl: null };
vi.mock("@/lib/lab/env", () => ({ getLabSettings: () => settings }));

const events: Array<{ kind: string; payload?: Record<string, unknown> }> = [];
vi.mock("@/lib/lab/events", () => ({
  labEvent: async (kind: string, _level: string, ctx: { payload?: Record<string, unknown> }) => {
    events.push({ kind, payload: ctx?.payload });
  },
}));
vi.mock("@/lib/lab/log", () => ({ labLog: () => undefined, newRequestId: () => "req-test" }));

type Session = { id: string; status: string; language: string; email: string; flags: Record<string, unknown> };
const sessions = new Map<string, Session>();
vi.mock("@/lib/lab/store", () => ({ getSessionById: async (id: string) => sessions.get(id) ?? null }));

const recorded: unknown[] = [];
vi.mock("@/lib/lab/admin", () => ({
  recordDecision: async (row: Record<string, unknown>) => {
    recorded.push(row);
    return { id: "d1", ...row, decided_at: "2026-09-24T12:00:00Z" };
  },
}));
const sent: unknown[] = [];
vi.mock("@/lib/lab/decisions", () => ({
  sendDecisionEmail: async (session: Session, input: Record<string, unknown>) => {
    sent.push({ to: session.email, ...input });
    return { sent: true };
  },
}));

import { NextRequest } from "next/server";
import { POST as decide } from "@/app/api/admin/lab/[id]/decision/route";
import { POST as sendEmail } from "@/app/api/admin/lab/[id]/send-email/route";

function call(handler: typeof decide, id: string, body: unknown, token: string | null = "token") {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const req = new NextRequest(`https://stryvia.ai/api/admin/lab/${id}/x`, { method: "POST", headers, body: JSON.stringify(body) });
  return handler(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  auth.ok = true;
  auth.email = "owner@stryvia.ai";
  settings.reviewerEmails = [];
  events.length = 0;
  recorded.length = 0;
  sent.length = 0;
  sessions.clear();
  sessions.set("submitted", { id: "submitted", status: "submitted", language: "en", email: "v@example.com", flags: {} });
  sessions.set("open", { id: "open", status: "in_progress", language: "en", email: "v@example.com", flags: {} });
  sessions.set("nocontact", { id: "nocontact", status: "submitted", language: "ar", email: "v@example.com", flags: { no_contact: true, test: true } });
});

describe("recording a decision", () => {
  it("refuses an unauthenticated caller and records nothing", async () => {
    auth.ok = false;
    auth.reason = "no_token";
    const res = await call(decide, "submitted", { decision: "hold", confirmed: true }, null);
    expect(res.status).toBe(401);
    expect(recorded).toEqual([]);
  });

  it("refuses an admin who is not on the reviewer list, and audits the refusal", async () => {
    settings.reviewerEmails = ["ibrahim@stryvia.ai"];
    const res = await call(decide, "submitted", { decision: "book_call", confirmed: true });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "not_reviewer" });
    expect(recorded).toEqual([]);
    expect(events.find((e) => e.kind === "decision.refused")?.payload).toMatchObject({ code: "not_reviewer" });
  });

  it("refuses a call without explicit confirmation", async () => {
    const res = await call(decide, "submitted", { decision: "decline" });
    expect(res.status).toBe(400);
    expect(recorded).toEqual([]);
    const falsy = await call(decide, "submitted", { decision: "decline", confirmed: false });
    expect(falsy.status).toBe(400);
  });

  it("refuses to decide on a session that has not been submitted", async () => {
    const res = await call(decide, "open", { decision: "decline", confirmed: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "not_submitted" });
    expect(recorded).toEqual([]);
  });

  it("records a confirmed decision by an authorised reviewer with their identity, without sending anything", async () => {
    settings.reviewerEmails = ["owner@stryvia.ai"];
    const res = await call(decide, "submitted", { decision: "hold", notes: "call later", confirmed: true });
    expect(res.status).toBe(200);
    expect(recorded).toEqual([{ session_id: "submitted", decision: "hold", notes: "call later", decided_by: "owner@stryvia.ai" }]);
    expect(sent).toEqual([]);
  });
});

describe("communicating a decision", () => {
  const draft = { action: "book_call", subject: "Next step", body: "Thank you for the brief. Would you have time for a short call next week?" };

  it("preview renders the exact email and sends nothing", async () => {
    const res = await call(sendEmail, "nocontact", { ...draft, mode: "preview" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.preview.to).toBe("v@example.com");
    expect(data.preview.text).toContain("Thank you for the brief.");
    expect(data.preview.html).toContain('dir="rtl"');
    expect(data.noContact).toBe(true);
    expect(data.test).toBe(true);
    expect(sent).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it("send requires explicit confirmation", async () => {
    const res = await call(sendEmail, "submitted", { ...draft, mode: "send" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "confirmation_required" });
    expect(sent).toEqual([]);
  });

  it("send is blocked for a visitor who asked not to be contacted unless explicitly overridden", async () => {
    const blocked = await call(sendEmail, "nocontact", { ...draft, mode: "send", confirmed: true });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({ ok: false, error: "no_contact_requested" });
    expect(sent).toEqual([]);
    expect(events.find((e) => e.kind === "decision.send_blocked")?.payload).toMatchObject({ code: "no_contact" });

    const overridden = await call(sendEmail, "nocontact", { ...draft, mode: "send", confirmed: true, overrideNoContact: true });
    expect(overridden.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "v@example.com", decidedBy: "owner@stryvia.ai", language: "ar" });
  });

  it("send is refused for a non-reviewer and for an in-progress session", async () => {
    settings.reviewerEmails = ["ibrahim@stryvia.ai"];
    expect((await call(sendEmail, "submitted", { ...draft, mode: "send", confirmed: true })).status).toBe(403);
    settings.reviewerEmails = [];
    expect((await call(sendEmail, "open", { ...draft, mode: "send", confirmed: true })).status).toBe(409);
    expect(sent).toEqual([]);
  });
});
