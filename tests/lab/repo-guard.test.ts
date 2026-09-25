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

  it("no visitor, AI or background path can record a decision or email one", () => {
    // Only the two admin routes and the admin/decisions modules may touch the
    // decision table or the sender. The engine, assessor, cron and the visitor
    // surface never can, whatever a prompt or a model output says.
    const allowed = new Set([
      "src/app/api/admin/lab/[id]/decision/route.ts",
      "src/app/api/admin/lab/[id]/send-email/route.ts",
      "src/lib/lab/admin.ts",
      "src/lib/lab/decisions.ts",
    ]);
    const offenders = walk(path.join(root, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /recordDecision|sendDecisionEmail|lab_decisions/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f))
      .filter((f) => !allowed.has(f));
    expect(offenders).toEqual([]);
    // The assessor and the post-submit pipeline never change a session's status.
    for (const f of ["src/lib/lab/assessor.ts", "src/lib/lab/submit.ts", "src/lib/lab/notify.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/status:\s*"(reviewed|closed|deleted)"/);
      expect(src, f).not.toMatch(/recordDecision|sendDecisionEmail/);
    }
  });

  it("decisions need explicit confirmation and a server-side reviewer check", () => {
    const decision = read("src/app/api/admin/lab/[id]/decision/route.ts");
    expect(decision).toMatch(/confirmed: z\.literal\(true\)/);
    expect(decision).toMatch(/if \(!canDecide\(admin\)\)/);
    const send = read("src/app/api/admin/lab/[id]/send-email/route.ts");
    expect(send).toMatch(/mode: z\.enum\(\["preview", "send"\]\)/);
    expect(send).toMatch(/parsed\.data\.confirmed !== true/);
    expect(send).toMatch(/no_contact/);
    expect(send).toMatch(/if \(!canDecide\(admin\)\)/);
  });

  it("brief operations, finish and submit all run under the session lock with a version check", () => {
    for (const f of ["brief", "finish", "submit"]) {
      const src = read(`src/app/api/lab/session/[id]/${f}/route.ts`);
      expect(src, f).toMatch(/withSessionLock\(/);
    }
    const brief = read("src/app/api/lab/session/[id]/brief/route.ts");
    expect(brief).toMatch(/current\.version !== body\.baseVersion/);
    expect(read("src/app/api/lab/session/[id]/submit/route.ts")).toMatch(/brief\.version !== parsed\.data\.version/);
    // Translation and revision read ONE saved version, never the transcript.
    const lib = read("src/lib/lab/brief.ts");
    const translate = lib.slice(lib.indexOf("export async function translateBrief"), lib.indexOf("export async function reviseBrief"));
    const revise = lib.slice(lib.indexOf("export async function reviseBrief"), lib.indexOf("export async function acceptBriefVersion"));
    for (const fn of [translate, revise]) {
      expect(fn).not.toMatch(/listMessages|transcriptText|describeState/);
      expect(fn).toMatch(/normalizeBrief\(base\.content\)/);
      expect(fn).toMatch(/matchesLanguage\(/);
    }
    expect(translate).toMatch(/checkFactPreservation\(source, candidate\)/);
  });

  it("the print view freezes to the submitted version and stamps it", () => {
    const src = read("src/app/[locale]/lab/s/[sessionId]/brief/route.ts");
    expect(src).toMatch(/session\.submitted_brief_version == null/);
    expect(src).toMatch(/X-Lab-Brief-Version/);
    expect(src).toMatch(/brief\.language === "ar"/);
  });

  it("workflow flags are rendered from session metadata, never from prose", () => {
    expect(read("src/lib/lab/brief.ts")).toMatch(/flags: session\.flags/);
    expect(read("src/lib/lab/render.ts")).toMatch(/data-structural/);
    const engine = read("src/lib/lab/engine.ts");
    // Flags are only ever set, never cleared, and come from signals OR regexes.
    expect(engine).toMatch(/if \(hit\.test && !value\.test\)/);
    expect(engine).not.toMatch(/value\.test = false|value\.no_contact = false/);
  });

  it("brief-version migrations ship down files", () => {
    for (const m of ["0007_lab_brief_versions", "0008_lab_session_flags"]) {
      expect(read(`supabase/migrations/${m}.sql`)).toMatch(/alter table/);
      expect(read(`supabase/migrations/down/${m}.down.sql`)).toMatch(/drop column/);
    }
  });

  it("prompts carry the non-negotiable rules", () => {
    const brief = read("src/lib/lab/prompts/brief.ts");
    expect(brief).toMatch(/infer a preference from openness/i);
    expect(brief).toMatch(/never treat a partial or one-month figure as a cap/i);
    expect(brief).toMatch(/manual review; no partnership or project decision has been made/i);
    expect(brief).toMatch(/return null for a step that was not relevant/i);
    const ops = read("src/lib/lab/prompts/brief-ops.ts");
    expect(ops).toMatch(/numbers/i);
    expect(ops).toMatch(/do not add/i);
    const interviewer = read("src/lib/lab/prompts/interviewer.ts");
    expect(interviewer).toMatch(/DECISIONS ARE NOT YOURS/);
    expect(interviewer).toMatch(/already answered|already known|never ask again|do not ask again/i);
  });

  it("no response-time promise is hard-coded anywhere visitors read", () => {
    for (const locale of ["en", "ar"]) {
      const pages = read(`src/messages/${locale}.pages.json`);
      expect(pages).not.toMatch(/7 working days|seven working days|7 أيام عمل|سبعة أيام عمل/);
    }
    expect(read("src/config/lab.config.ts")).not.toMatch(/LAB_RESPONSE_DAYS\s*=\s*\d/);
  });

  it("the theme coachmark never shows inside the Lab flow", () => {
    expect(read("src/components/layout/ThemePicker.tsx")).toMatch(/inFocusedFlow/);
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
