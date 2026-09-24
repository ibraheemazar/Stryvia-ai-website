#!/usr/bin/env node
// Founder review round (brief §10.4): bundles harness results into one folder
// of readable briefs + scorecards to annotate.
//
//   node scripts/lab/export-review-round.mjs [--from docs/lab/harness] [--out docs/lab/REVIEW_ROUND_1] [--limit 10]

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const FROM = opt("--from", "docs/lab/harness");
const OUT = opt("--out", "docs/lab/REVIEW_ROUND_1");
const LIMIT = Number(opt("--limit", 10));

if (!fs.existsSync(FROM)) {
  console.error(`No harness output at ${FROM}. Run npm run lab:personas first.`);
  process.exit(1);
}
const files = fs.readdirSync(FROM).filter((f) => f.endsWith(".json")).slice(0, LIMIT);
fs.mkdirSync(OUT, { recursive: true });
const index = ["# Review round — briefs and scorecards to annotate", "", "For each item: does the AI's judgement match yours? Mark agree / disagree and why. Then prompts and rubric get tuned and the harness re-runs.", "", "| # | Persona | Verdict | Weighted | Your verdict | Notes |", "|---|---|---|---:|---|---|"];
files.forEach((f, i) => {
  const r = JSON.parse(fs.readFileSync(path.join(FROM, f), "utf8"));
  const b = r.brief ?? {};
  const md = [
    `# ${r.id} — brief and private scorecard`,
    "",
    `Session ${r.sessionId} · ${r.language} · ${r.turns} turns · verdict **${r.verdict ?? "—"}** (model: ${r.modelVerdict ?? "—"}) · weighted ${r.weighted ?? "—"}`,
    "",
    "## Brief",
    "",
    b.title ? `### ${b.title}` : "(no brief)",
    b.one_line ? `_${b.one_line}_` : "",
    "",
    b.what_you_came_with ? ["**What you came with**", ...Object.entries(b.what_you_came_with).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join("; ") : v}`)].join("\n") : "",
    "",
    b.what_it_could_become ? ["**What it could become**", ...Object.entries(b.what_it_could_become).map(([k, v]) => `- ${k}: ${v}`)].join("\n") : "",
    "",
    "## Private scorecard",
    "",
    r.flags?.length ? `Red flags: ${r.flags.join(", ")}` : "Red flags: none",
    "",
    r.judge && !r.judge.error ? `Judge quality ${r.judge.overall_quality_1_5}/5 — ${r.judge.notes}` : "",
    "",
    "## Your annotation",
    "",
    "- Agree with the verdict? [ ] yes [ ] no — because:",
    "- What the AI missed:",
    "- What the AI over-weighted:",
    "",
    "## Transcript",
    "",
    ...(r.transcript ?? []).map((t) => `**${t.role === "user" ? "VISITOR" : t.role === "assistant" ? "STRYVIA AI" : "SYSTEM"}**: ${t.content}\n`),
  ].join("\n");
  fs.writeFileSync(path.join(OUT, `${String(i + 1).padStart(2, "0")}-${r.id}.md`), md);
  index.push(`| ${i + 1} | ${r.id} | ${r.verdict ?? "—"} | ${r.weighted ?? "—"} |  |  |`);
});
fs.writeFileSync(path.join(OUT, "README.md"), index.join("\n") + "\n");
console.log(`Exported ${files.length} items to ${OUT}`);
