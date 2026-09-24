import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAB_CONSENT_VERSION } from "@/config/lab.config";

// Repo-guard tests (TESTING.md §4b): structural invariants that no behavioural
// test can observe — a refactor that drops one of these produces no failing
// output, only a silent security hole.

const root = path.resolve(__dirname, "../..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("visitor routes", () => {
  const sessionRoutes = walk(path.join(root, "src/app/api/lab/session")).filter((f) => f.endsWith("route.ts"));
  const localeBriefRoute = path.join(root, "src/app/[locale]/lab/s/[sessionId]/brief/route.ts");

  it("exist", () => expect(sessionRoutes.length).toBeGreaterThanOrEqual(7));

  it.each([...sessionRoutes, localeBriefRoute])("%s enforces ownership through the chokepoint", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/ownerOr\(req, params\.(id|sessionId)\)/);
  });

  const visitorSurface = [
    ...walk(path.join(root, "src/app/api/lab")),
    ...walk(path.join(root, "src/app/[locale]/lab")),
    ...walk(path.join(root, "src/components/lab")),
  ].filter((f) => /\.(ts|tsx)$/.test(f));

  it.each(visitorSurface)("%s never touches assessments, decisions or the founder pipeline", (file) => {
    const src = readFileSync(file, "utf8");
    // The submit route may schedule the private pipeline but never read it back.
    const allowedPipelineImport = file.endsWith(path.join("submit", "route.ts"));
    expect(src).not.toMatch(/lab_assessments|lab_decisions|getLatestAssessment|runAssessment/);
    if (!allowedPipelineImport) expect(src).not.toMatch(/lab\/submit|lab\/notify|lab\/assessor/);
    expect(src).not.toMatch(/verdict|weighted_score/);
  });

  it("only the AI provider factory imports the mock", () => {
    const importers = walk(path.join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && readFileSync(f, "utf8").includes("ai-mock"));
    expect(importers.map((f) => path.relative(root, f))).toEqual(["src/lib/lab/ai-mock.ts", "src/lib/lab/ai.ts"].filter((p) => importers.some((f) => f.endsWith(p))));
    expect(importers.some((f) => f.endsWith("src/lib/lab/ai.ts"))).toBe(true);
  });
});

describe("configuration invariants", () => {
  it("consent copy is tied to the consent version", () => {
    for (const locale of ["en", "ar"]) {
      const pages = JSON.parse(read(`src/messages/${locale}.pages.json`));
      expect(pages.lab.consent.version).toBe(LAB_CONSENT_VERSION);
    }
  });

  it("Arabic and English lab catalogs have the same keys", () => {
    const flat = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
    const en = flat(JSON.parse(read("src/messages/en.pages.json")).lab).sort();
    const ar = flat(JSON.parse(read("src/messages/ar.pages.json")).lab).sort();
    expect(ar).toEqual(en);
  });

  it("security headers: Turnstile frame-src and lab-only microphone", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toMatch(/frame-src 'self' https:\/\/challenges\.cloudflare\.com/);
    expect(cfg).toMatch(/microphone=\(self\)/);
    expect(cfg).toMatch(/"\/lab\/:path\*"/);
  });

  it("the site chat dock hides on lab routes and the intl middleware ignores /admin", () => {
    expect(read("src/components/chat/ChatDock.tsx")).toMatch(/HIDE_PREFIX = \["\/lab"\]/);
    expect(read("src/middleware.ts")).toMatch(/api\|supadmin\|admin\|/);
  });

  it("Arabic headings use the Arabic face without tracking", () => {
    const css = read("src/styles/globals.css");
    expect(css).toMatch(/\[dir="rtl"\] :is\(h1, h2, h3, h4, \.font-display\) \{\s*font-family: var\(--font-ar\);\s*letter-spacing: 0;/);
  });

  it("the migration enables RLS on every lab table and ships a down file", () => {
    const up = read("supabase/migrations/0006_idea_lab.sql");
    const tables = [...up.matchAll(/create table if not exists public\.(lab_\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThanOrEqual(12);
    for (const t of tables) expect(up).toContain(`alter table public.${t} enable row level security;`);
    expect(up).not.toMatch(/create policy/i);
    const down = read("supabase/migrations/down/0006_idea_lab.down.sql");
    for (const t of tables) expect(down).toContain(`drop table if exists public.${t};`);
  });

  it("AI usage log never stores prompt or response text", () => {
    const store = read("src/lib/lab/store.ts");
    const fn = store.slice(store.indexOf("export async function logAiCall"), store.indexOf("// ---- Magic links"));
    expect(fn).not.toMatch(/prompt|content|text/i);
  });
});
