import "server-only";
import { RED_FLAGS, RUBRIC_DIMENSIONS, VERDICT_LABELS, type Verdict } from "@/config/lab-rubric.config";
import type { LabLanguage } from "@/config/lab.config";
import type { SessionDetail } from "./admin";
import { escapeHtml } from "./guardrails";
import { lensText } from "./prompts/interviewer";
import { renderBriefText } from "./render";
import { BriefSchema } from "./schemas";
import { SLOT_IDS, SLOT_META, slotConfidence } from "./slots";

// Review packet (brief §8): one document per submission with contact details,
// both parts of the brief, scorecard with evidence and red flags, the AI's
// proposed plan, slot state and the full transcript. Markdown for pasting into
// a separate discussion; HTML for print → PDF.

function fmtDate(s: string | null): string {
  return s ? new Date(s).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—";
}

export function packetMarkdown(d: SessionDetail): string {
  const { session: s, brief, assessment: a, state, messages, decisions, notes } = d;
  const lines: string[] = [];
  lines.push(`# Idea Lab review packet — ${s.visitor_name}${s.company ? ` (${s.company})` : ""}`);
  lines.push("");
  lines.push(`Session \`${s.id}\` · started ${fmtDate(s.created_at)} · submitted ${fmtDate(s.submitted_at)} · ${s.turn_count} visitor turns · ${s.language.toUpperCase()} · prompt ${s.prompt_version}${a ? ` · rubric ${a.rubric_version}` : ""} · cost $${Number(s.token_usage?.cost_usd ?? 0).toFixed(3)}`);
  lines.push("");
  lines.push("## Contact");
  lines.push(`- Name: ${s.visitor_name}`);
  lines.push(`- Email: ${s.email}`);
  lines.push(`- Phone: ${s.phone_e164}`);
  lines.push(`- Country: ${s.country}`);
  if (s.company) lines.push(`- Company: ${s.company}`);
  if (s.role) lines.push(`- Role: ${s.role}`);
  lines.push(`- Industry (detected): ${state.slots.industry?.value ?? "—"}`);
  lines.push("");

  if (a) {
    lines.push("## Verdict");
    lines.push(`**${VERDICT_LABELS[a.verdict as Verdict]}** — weighted ${Number(a.weighted_score).toFixed(2)} / 5, confidence ${Number(a.confidence).toFixed(2)}${a.model_verdict && a.model_verdict !== a.verdict ? ` (model suggested \`${a.model_verdict}\`; rubric decided)` : ""}${a.manipulation_detected ? " · ⚠ manipulation attempt detected" : ""}`);
    lines.push("");
    for (const w of a.why_lines) lines.push(`- ${w}`);
    lines.push("");
    lines.push("## Scorecard");
    lines.push("| Dimension | Score | Note | Evidence |");
    lines.push("|---|---:|---|---|");
    for (const dim of RUBRIC_DIMENSIONS) {
      const sc = a.scores[dim.id];
      lines.push(`| ${dim.label} | ${sc.score} | ${sc.note.replace(/\|/g, "/")} | ${sc.evidence.map((e) => `"${e.replace(/\|/g, "/")}"`).join(" · ")} |`);
    }
    lines.push("");
    lines.push("## Red flags");
    const triggered = a.red_flags.filter((f) => f.triggered);
    if (triggered.length === 0) lines.push("None triggered.");
    for (const f of triggered) lines.push(`- **${RED_FLAGS.find((r) => r.id === f.id)?.label ?? f.id}** — ${f.evidence}`);
    lines.push("");
    lines.push("## Assessor reasoning");
    lines.push(a.reasoning);
    lines.push("");
    if (a.proposed_plan) {
      lines.push("## AI's proposed plan (internal)");
      lines.push(`- What Stryvia could build: ${a.proposed_plan.what_stryvia_could_build}`);
      lines.push(`- Rough scope: ${a.proposed_plan.rough_scope}`);
      lines.push(`- Suggested deal shape: ${a.proposed_plan.suggested_deal_shape}`);
      if (a.proposed_plan.open_questions.length) {
        lines.push("- Open questions:");
        for (const q of a.proposed_plan.open_questions) lines.push(`  - ${q}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## Verdict");
    lines.push(`Assessment status: ${s.assessment_status}. No assessment yet.`);
    lines.push("");
  }

  lines.push("## Brief");
  if (brief) {
    const parsed = BriefSchema.safeParse(brief.content);
    lines.push(parsed.success ? renderBriefText(parsed.data, brief.language as LabLanguage) : "(brief could not be parsed)");
    lines.push("");
    lines.push(`_Version ${brief.version}${brief.visitor_edited ? ", edited by the visitor" : ""}._`);
  } else {
    lines.push("No brief generated.");
  }
  lines.push("");

  lines.push("## Slot state");
  lines.push("| Slot | Confidence | Value |");
  lines.push("|---|---:|---|");
  for (const id of SLOT_IDS) {
    if (id === "expansion_reactions") {
      const l = state.slots.expansion_reactions;
      if (l) {
        for (const step of ["automate", "intelligence", "productize", "scale"] as const) {
          const e = l[step];
          if (e) lines.push(`| ladder · ${step} | — | ${e.reaction} — "${e.quote.replace(/\|/g, "/")}" |`);
        }
      }
      continue;
    }
    const e = state.slots[id];
    if (!e) continue;
    lines.push(`| ${SLOT_META[id].label} | ${slotConfidence(state.slots, id).toFixed(2)} | ${e.value.replace(/\|/g, "/").replace(/\n/g, " ")} |`);
  }
  lines.push("");
  if (state.industry_lens) {
    lines.push("## Industry lens (generated)");
    lines.push("```");
    lines.push(lensText(state.industry_lens));
    lines.push("```");
    lines.push("");
  }

  if (decisions.length || notes.length) {
    lines.push("## Decisions and notes");
    for (const dec of decisions) lines.push(`- ${fmtDate(dec.decided_at)} · **${dec.decision}** by ${dec.decided_by}${dec.outbound_email_sent_at ? ` · email sent: "${dec.outbound_email_subject}"` : ""}${dec.notes ? ` · ${dec.notes}` : ""}`);
    for (const n of notes) lines.push(`- ${fmtDate(n.created_at)} · note by ${n.author}: ${n.body}`);
    lines.push("");
  }

  lines.push("## Transcript");
  for (const m of messages) {
    if (m.role === "system") continue;
    const who = m.role === "user" ? `VISITOR${m.input_mode === "voice" ? " (voice)" : ""}` : "STRYVIA AI";
    lines.push(`**${who}** · ${fmtDate(m.created_at)}`);
    lines.push("");
    lines.push(m.content.split("\n").map((l) => `> ${l}`).join("\n"));
    if (m.role === "user" && m.input_mode === "voice" && m.transcript_raw && m.transcript_raw !== m.content) {
      lines.push(`> _raw transcript:_ ${m.transcript_raw}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Minimal Markdown → HTML for the print packet (headings, tables, quotes, lists, bold, code). */
export function packetHtml(d: SessionDetail): string {
  const md = packetMarkdown(d);
  const lines = md.split("\n");
  const out: string[] = [];
  let inTable = false;
  let inCode = false;
  let inList = false;
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const raw of lines) {
    if (raw.startsWith("```")) {
      closeList();
      inCode = !inCode;
      out.push(inCode ? "<pre>" : "</pre>");
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(raw));
      continue;
    }
    if (raw.startsWith("|")) {
      const cells = raw.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      if (!inTable) {
        closeList();
        out.push("<table>");
        inTable = true;
        out.push(`<tr>${cells.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>`);
      } else {
        out.push(`<tr>${cells.map((c) => `<td dir="auto">${inline(c)}</td>`).join("")}</tr>`);
      }
      continue;
    }
    if (inTable) {
      out.push("</table>");
      inTable = false;
    }
    if (raw.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inline(raw.slice(2))}</h1>`);
    } else if (raw.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inline(raw.slice(3))}</h2>`);
    } else if (raw.startsWith("> ")) {
      closeList();
      out.push(`<blockquote dir="auto">${inline(raw.slice(2))}</blockquote>`);
    } else if (/^\s*- /.test(raw)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li dir="auto">${inline(raw.replace(/^\s*- /, ""))}</li>`);
    } else if (raw.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p dir="auto">${inline(raw)}</p>`);
    }
  }
  closeList();
  if (inTable) out.push("</table>");
  const title = `Idea Lab packet — ${d.session.visitor_name}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>
body{margin:0;padding:32px 20px;background:#fff;color:#1a1c1a;font:15px/1.55 'Hanken Grotesk','Helvetica Neue',Arial,sans-serif;max-width:860px;margin-inline:auto}
h1{font-size:26px;line-height:1.2;margin:0 0 8px}h2{font-size:18px;margin:28px 0 8px;padding-top:12px;border-top:1px solid #d9ddd8}
table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{border:1px solid #d9ddd8;padding:6px 8px;vertical-align:top;text-align:start}th{background:#f4f6f4}
blockquote{margin:4px 0;padding:6px 12px;border-inline-start:3px solid #c0fa20;background:#f7f9f6}ul{padding-inline-start:20px}pre{background:#f4f6f4;padding:10px;font-size:12px;white-space:pre-wrap}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px}[dir=auto]{unicode-bidi:plaintext}
.no-print{position:fixed;inset-block-start:12px;inset-inline-end:12px;background:#c0fa20;border:0;border-radius:4px;padding:10px 16px;font:600 14px system-ui;cursor:pointer}
@media print{.no-print{display:none}body{padding:0}@page{margin:14mm}}
</style></head><body><button class="no-print" onclick="window.print()">Print / Save as PDF</button>
${out.join("\n")}
</body></html>`;
}
