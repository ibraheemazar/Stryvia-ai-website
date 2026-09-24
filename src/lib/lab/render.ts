import type { LabLanguage } from "@/config/lab.config";
import { escapeHtml } from "./guardrails";
import type { Brief } from "./schemas";

// Brief → HTML for email and print (brief §2.7). Pure and dependency-free so it
// runs in tests and in email/print contexts. RTL is applied structurally
// (`dir` + logical alignment) and Latin fragments are bidi-isolated.

export const BRIEF_LABELS: Record<LabLanguage, Record<string, string>> = {
  en: {
    part1: "What you came with",
    part2: "What it could become",
    part2Note: "Ideas explored together with Stryvia's AI — not commitments from either side.",
    problem: "The problem",
    who: "Who is affected",
    process: "How it works today",
    frequency: "Frequency and volume",
    cost: "What it costs today",
    tried: "What you have tried",
    tools: "Tools in use",
    outcome: "What you want",
    automate: "1 · Automate it",
    intelligence: "2 · Add intelligence",
    productize: "3 · Productize it",
    scale: "4 · Scale it",
    ceiling: "An honest note on the ceiling",
    bring: "What you bring",
    expect: "What you expect",
    constraints: "Constraints and regulation",
    next: "What happens next",
    preparedFor: "Prepared for",
    by: "by Stryvia's AI in the Stryvia Idea Lab",
  },
  ar: {
    part1: "ما جئت به",
    part2: "ما يمكن أن يصبح",
    part2Note: "أفكار استكشفناها معًا مع الذكاء الاصطناعي من سترايفيا — وليست التزامات من أي طرف.",
    problem: "المشكلة",
    who: "من يتأثر بها",
    process: "كيف يجري العمل اليوم",
    frequency: "التكرار والحجم",
    cost: "ما تكلّفه اليوم",
    tried: "ما جرّبته حتى الآن",
    tools: "الأدوات المستخدمة",
    outcome: "ما تريده",
    automate: "١ · أتمتته",
    intelligence: "٢ · إضافة الذكاء",
    productize: "٣ · تحويله إلى منتج",
    scale: "٤ · التوسّع",
    ceiling: "كلمة صادقة عن السقف",
    bring: "ما تقدّمه أنت",
    expect: "ما تتوقّعه",
    constraints: "القيود والتنظيم",
    next: "ماذا بعد",
    preparedFor: "أُعدّ لـ",
    by: "بواسطة الذكاء الاصطناعي من سترايفيا في مختبر الأفكار",
  },
};

/** Wrap Latin/number fragments inside Arabic text in <bdi> so they keep their
 *  own direction. Applied after escaping. */
export function isolateLatin(escaped: string, language: LabLanguage): string {
  if (language !== "ar") return escaped;
  // Entities (&lt; &amp; &#39;) are left intact; only real Latin words/numbers are wrapped.
  return escaped.replace(/(&[a-zA-Z#0-9]+;)|([A-Za-z][A-Za-z0-9.+\-/_@:]*|\d[\d.,%]*)/g, (m, ent, word) => (ent ? ent : `<bdi>${word}</bdi>`));
}

function t(s: string, language: LabLanguage): string {
  return isolateLatin(escapeHtml(s), language);
}

function block(label: string, body: string, language: LabLanguage): string {
  return `<tr><td style="padding:0 0 18px 0;">
<div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:${language === "ar" ? "0" : "0.12em"};text-transform:uppercase;color:#7aa60f;margin-bottom:6px;">${escapeHtml(label)}</div>
<div style="font-size:16px;line-height:1.6;color:#1a1c1a;">${body}</div>
</td></tr>`;
}

function para(s: string, language: LabLanguage): string {
  return `<p style="margin:0 0 8px 0;">${t(s, language)}</p>`;
}

function list(items: string[], language: LabLanguage, ordered = false): string {
  if (!items.length) return para("—", language);
  const tag = ordered ? "ol" : "ul";
  return `<${tag} style="margin:0;padding-inline-start:20px;">${items
    .map((i) => `<li style="margin:0 0 6px 0;">${t(i, language)}</li>`)
    .join("")}</${tag}>`;
}

export function renderBriefHtml(
  brief: Brief,
  opts: { language: LabLanguage; visitorName: string; siteUrl?: string },
): string {
  const L = BRIEF_LABELS[opts.language];
  const lang = opts.language;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font =
    lang === "ar"
      ? "'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif"
      : "'Hanken Grotesk','Helvetica Neue',Arial,sans-serif";
  const p1 = brief.what_you_came_with;
  const p2 = brief.what_it_could_become;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t(brief.title, lang)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="direction:${dir};background:#f4f6f4;font-family:${font};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:640px;direction:${dir};text-align:start;">
<tr><td style="padding:0 0 24px 0;border-bottom:1px solid #d9ddd8;">
  <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:${lang === "ar" ? "0" : "0.14em"};text-transform:uppercase;color:#6f7a6e;">STRYVIA IDEA LAB</div>
  <h1 style="margin:10px 0 6px 0;font-size:28px;line-height:1.2;color:#0a0b0a;font-weight:600;">${t(brief.title, lang)}</h1>
  <p style="margin:0;font-size:16px;line-height:1.55;color:#3b403a;">${t(brief.one_line, lang)}</p>
  <p style="margin:12px 0 0 0;font-size:13px;color:#6f7a6e;">${escapeHtml(L.preparedFor)} <bdi>${escapeHtml(opts.visitorName)}</bdi> · ${escapeHtml(L.by)}</p>
</td></tr>
<tr><td style="padding:24px 0 8px 0;"><h2 style="margin:0;font-size:20px;color:#0a0b0a;font-weight:600;">${escapeHtml(L.part1)}</h2></td></tr>
${block(L.problem, para(p1.problem, lang), lang)}
${block(L.who, para(p1.who_is_affected, lang), lang)}
${block(L.process, list(p1.current_process, lang, true), lang)}
${block(L.frequency, para(p1.frequency_and_volume, lang), lang)}
${block(L.cost, para(p1.cost_today, lang), lang)}
${block(L.tried, para(p1.tried_so_far, lang), lang)}
${block(L.tools, para(p1.tools, lang), lang)}
${block(L.outcome, para(p1.desired_outcome, lang), lang)}
<tr><td style="padding:16px 0 8px 0;border-top:1px solid #d9ddd8;">
  <h2 style="margin:16px 0 4px 0;font-size:20px;color:#0a0b0a;font-weight:600;">${escapeHtml(L.part2)}</h2>
  <p style="margin:0 0 12px 0;font-size:13px;color:#6f7a6e;">${escapeHtml(L.part2Note)}</p>
  <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#1a1c1a;">${t(p2.intro, lang)}</p>
</td></tr>
${block(L.automate, para(p2.automate, lang), lang)}
${block(L.intelligence, para(p2.add_intelligence, lang), lang)}
${block(L.productize, para(p2.productize, lang), lang)}
${block(L.scale, para(p2.scale, lang), lang)}
${block(L.ceiling, para(p2.honest_ceiling_note, lang), lang)}
<tr><td style="padding:8px 0 8px 0;border-top:1px solid #d9ddd8;"></td></tr>
${block(L.bring, list(brief.what_you_bring, lang), lang)}
${block(L.expect, para(brief.what_you_expect, lang), lang)}
${block(L.constraints, para(brief.constraints, lang), lang)}
${block(L.next, para(brief.next_step_note, lang), lang)}
<tr><td style="padding:24px 0 0 0;border-top:1px solid #d9ddd8;font-size:12px;color:#6f7a6e;line-height:1.5;">
  <bdi>stryvia.ai</bdi>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Plain-text version for the email text part and the review packet. */
export function renderBriefText(brief: Brief, language: LabLanguage): string {
  const L = BRIEF_LABELS[language];
  const p1 = brief.what_you_came_with;
  const p2 = brief.what_it_could_become;
  const lines = [
    brief.title,
    brief.one_line,
    "",
    `== ${L.part1} ==`,
    `${L.problem}: ${p1.problem}`,
    `${L.who}: ${p1.who_is_affected}`,
    `${L.process}:`,
    ...p1.current_process.map((s, i) => `  ${i + 1}. ${s}`),
    `${L.frequency}: ${p1.frequency_and_volume}`,
    `${L.cost}: ${p1.cost_today}`,
    `${L.tried}: ${p1.tried_so_far}`,
    `${L.tools}: ${p1.tools}`,
    `${L.outcome}: ${p1.desired_outcome}`,
    "",
    `== ${L.part2} ==`,
    L.part2Note,
    p2.intro,
    `${L.automate}: ${p2.automate}`,
    `${L.intelligence}: ${p2.add_intelligence}`,
    `${L.productize}: ${p2.productize}`,
    `${L.scale}: ${p2.scale}`,
    `${L.ceiling}: ${p2.honest_ceiling_note}`,
    "",
    `${L.bring}:`,
    ...brief.what_you_bring.map((b) => `  - ${b}`),
    `${L.expect}: ${brief.what_you_expect}`,
    `${L.constraints}: ${brief.constraints}`,
    `${L.next}: ${brief.next_step_note}`,
  ];
  return lines.join("\n");
}
