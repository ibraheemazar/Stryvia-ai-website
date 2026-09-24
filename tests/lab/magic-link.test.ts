import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: Array<{ token_hash: string; email: string; purpose: string; expires_at: string; used_at: string | null }> = [];
vi.mock("@/lib/lab/store", () => ({
  insertMagicLink: async (r: (typeof rows)[number]) => {
    rows.push({ ...r, used_at: null });
  },
  peekMagicLink: async (hash: string, purpose: string) => rows.some((r) => r.token_hash === hash && r.purpose === purpose && !r.used_at && new Date(r.expires_at) > new Date()),
  consumeMagicLinkRow: async (hash: string, purpose: string) => {
    const r = rows.find((x) => x.token_hash === hash && x.purpose === purpose && !x.used_at && new Date(x.expires_at) > new Date());
    if (!r) return null;
    r.used_at = new Date().toISOString();
    return { email: r.email };
  },
}));

import { consumeMagicLink, createMagicLink, hashToken, magicLinkIsValid } from "@/lib/lab/magic-link";

describe("magic links", () => {
  beforeEach(() => rows.splice(0));

  it("stores only a hash, is single-use and purpose-bound", async () => {
    const { token } = await createMagicLink("Nora@Example.com", "resume");
    expect(rows[0].token_hash).toBe(hashToken(token));
    expect(rows[0].token_hash).not.toContain(token);
    expect(rows[0].email).toBe("nora@example.com");
    expect(await magicLinkIsValid(token, "resume")).toBe(true);
    expect(await consumeMagicLink(token, "delete")).toBeNull(); // wrong purpose
    expect(await consumeMagicLink(token, "resume")).toBe("nora@example.com");
    expect(await consumeMagicLink(token, "resume")).toBeNull(); // replay
    expect(await magicLinkIsValid(token, "resume")).toBe(false);
  });

  it("rejects malformed tokens without touching the store", async () => {
    expect(await consumeMagicLink("short", "resume")).toBeNull();
    expect(await consumeMagicLink("has spaces and $ymbols!!!!!!!!!!!!!", "resume")).toBeNull();
  });

  it("expired links are invalid", async () => {
    const { token } = await createMagicLink("a@b.co", "resume");
    rows[0].expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await magicLinkIsValid(token, "resume")).toBe(false);
    expect(await consumeMagicLink(token, "resume")).toBeNull();
  });
});
