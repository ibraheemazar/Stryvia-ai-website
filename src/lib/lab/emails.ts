import type { LabLanguage } from "@/config/lab.config";
import { LAB_NAME } from "@/config/lab.config";
import { escapeHtml } from "./guardrails";
import { isolateLatin } from "./render";

// Bilingual, RTL-correct HTML emails (brief §2.2, §2.7, §6, §8). Pure
// templates; sending lives in `mail.ts`. Every visitor-facing template only
// takes whitelisted inputs, so assessment data can never leak into an email.

type Shell = {
  language: LabLanguage;
  title: string;
  bodyHtml: string;
  bodyText: string;
  cta?: { label: string; url: string } | null;
  footerNote?: string;
};

export function emailShell(s: Shell): { html: string; text: string } {
  const lang = s.language;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font =
    lang === "ar"
      ? "'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif"
      : "'Hanken Grotesk','Helvetica Neue',Arial,sans-serif";
  const cta = s.cta
    ? `<tr><td style="padding:8px 0 24px 0;">
<a href="${escapeHtml(s.cta.url)}" style="display:inline-block;background:#c0fa20;color:#0a0b0a;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:4px;">${escapeHtml(s.cta.label)}</a>
</td></tr>`
    : "";
  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(s.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="direction:${dir};background:#f4f6f4;font-family:${font};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:600px;direction:${dir};text-align:start;">
<tr><td style="padding:0 0 20px 0;">
<div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:${lang === "ar" ? "0" : "0.14em"};text-transform:uppercase;color:#6f7a6e;">${escapeHtml(LAB_NAME[lang])}</div>
<h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.25;color:#0a0b0a;font-weight:600;">${escapeHtml(s.title)}</h1>
</td></tr>
<tr><td style="font-size:16px;line-height:1.65;color:#1a1c1a;padding:0 0 16px 0;">${s.bodyHtml}</td></tr>
${cta}
<tr><td style="padding:20px 0 0 0;border-top:1px solid #d9ddd8;font-size:12px;line-height:1.5;color:#6f7a6e;">
${s.footerNote ? `<p style="margin:0 0 8px 0;">${escapeHtml(s.footerNote)}</p>` : ""}
<bdi>stryvia.ai</bdi>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [s.title, "", s.bodyText, s.cta ? `\n${s.cta.label}: ${s.cta.url}` : "", s.footerNote ? `\n${s.footerNote}` : "", "\nstryvia.ai"]
    .filter((x) => x !== undefined)
    .join("\n");
  return { html, text };
}

function p(s: string, lang: LabLanguage): string {
  return `<p style="margin:0 0 12px 0;">${isolateLatin(escapeHtml(s), lang)}</p>`;
}

export function magicLinkEmail(input: { language: LabLanguage; name: string; url: string; expiresHours: number }) {
  const lang = input.language;
  const first = input.name.split(/\s+/)[0] || "";
  const copy =
    lang === "ar"
      ? {
          subject: "رابط العودة إلى محادثتك في مختبر الأفكار",
          title: `أهلًا ${first}، هذا رابط العودة`,
          body: [
            "احفظ هذه الرسالة. الرابط أدناه يفتح محادثتك في مختبر الأفكار من أي جهاز، حتى لو أغلقت الصفحة الآن.",
            `الرابط يعمل لمرة واحدة وصالح لمدة ${Math.round(input.expiresHours / 24)} أيام. إن لم تطلبه أنت، تجاهل هذه الرسالة.`,
          ],
          cta: "متابعة المحادثة",
          footer: "الذكاء الاصطناعي من سترايفيا يجري هذه المحادثة. لا شيء فيها يُعدّ التزامًا من أي طرف.",
        }
      : {
          subject: "Your link back to the Stryvia Idea Lab",
          title: `${first ? `${first}, here` : "Here"} is your way back in`,
          body: [
            "Keep this email. The link below reopens your Idea Lab conversation from any device, even if you close the page now.",
            `It works once and stays valid for ${Math.round(input.expiresHours / 24)} days. If you did not request it, ignore this email.`,
          ],
          cta: "Continue the conversation",
          footer: "This conversation is run by Stryvia's AI. Nothing in it is a commitment from either side.",
        };
  const shell = emailShell({
    language: lang,
    title: copy.title,
    bodyHtml: copy.body.map((s) => p(s, lang)).join(""),
    bodyText: copy.body.join("\n\n"),
    cta: { label: copy.cta, url: input.url },
    footerNote: copy.footer,
  });
  return { subject: copy.subject, ...shell };
}

export function deleteLinkEmail(input: { language: LabLanguage; url: string }) {
  const lang = input.language;
  const copy =
    lang === "ar"
      ? {
          subject: "تأكيد حذف بياناتك من مختبر الأفكار",
          title: "تأكيد حذف بياناتك",
          body: [
            "طلب أحدهم حذف كل بيانات مختبر الأفكار المرتبطة بهذا البريد: المحادثات والملخصات وبيانات التواصل.",
            "إن كنت أنت، اضغط الزر أدناه للتأكيد. الحذف نهائي ولا يمكن التراجع عنه. إن لم تطلب ذلك، تجاهل هذه الرسالة ولن يحدث شيء.",
          ],
          cta: "تأكيد الحذف",
        }
      : {
          subject: "Confirm deletion of your Idea Lab data",
          title: "Confirm you want your data deleted",
          body: [
            "Someone asked us to delete all Idea Lab data linked to this email: conversations, briefs and contact details.",
            "If that was you, press the button below to confirm. Deletion is permanent. If you did not ask for this, ignore this email and nothing will change.",
          ],
          cta: "Confirm deletion",
        };
  const shell = emailShell({
    language: lang,
    title: copy.title,
    bodyHtml: copy.body.map((s) => p(s, lang)).join(""),
    bodyText: copy.body.join("\n\n"),
    cta: { label: copy.cta, url: input.url },
  });
  return { subject: copy.subject, ...shell };
}

export function deletionDoneEmail(input: { language: LabLanguage }) {
  const lang = input.language;
  const copy =
    lang === "ar"
      ? { subject: "تم حذف بياناتك", title: "تم الحذف", body: ["حذفنا كل بيانات مختبر الأفكار المرتبطة بهذا البريد. لن نحتفظ بنسخة."] }
      : { subject: "Your data has been deleted", title: "Done", body: ["We deleted all Idea Lab data linked to this email. No copy is kept."] };
  const shell = emailShell({ language: lang, title: copy.title, bodyHtml: copy.body.map((s) => p(s, lang)).join(""), bodyText: copy.body.join("\n") });
  return { subject: copy.subject, ...shell };
}

/** The visitor's copy of their brief: the rendered brief HTML is the body. */
export function briefCopyEmail(input: {
  language: LabLanguage;
  name: string;
  briefHtml: string;
  briefText: string;
  responseDays: number;
  sessionUrl: string;
}) {
  const lang = input.language;
  const first = input.name.split(/\s+/)[0] || "";
  const copy =
    lang === "ar"
      ? {
          subject: "ملخّص فكرتك من مختبر الأفكار",
          intro: `أهلًا ${first}. هذا ملخّص فكرتك كما صغناه معًا. سيقرأه فريق سترايفيا ويردّ عليك خلال ${input.responseDays} أيام عمل. لا التزام على أي طرف، والملخّص ملكك تستخدمه أينما شئت.`,
          cta: "افتح ملخّصك",
        }
      : {
          subject: "Your idea brief from the Stryvia Idea Lab",
          intro: `Hi ${first}. Here is your brief as we shaped it together. Stryvia's team will read it and get back to you within ${input.responseDays} working days. No obligation on either side, and the brief is yours to use anywhere.`,
          cta: "Open your brief",
        };
  // The brief HTML is a full document; embed only its body table.
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(input.briefHtml);
  const inner = bodyMatch ? bodyMatch[1] : input.briefHtml;
  const html = `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escapeHtml(copy.subject)}</title></head><body style="margin:0;padding:0;background:#f4f6f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${lang === "ar" ? "rtl" : "ltr"}" style="direction:${lang === "ar" ? "rtl" : "ltr"};"><tr><td align="center" style="padding:24px 16px 0 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;text-align:start;font-family:${lang === "ar" ? "'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif" : "'Hanken Grotesk','Helvetica Neue',Arial,sans-serif"};">
<tr><td style="font-size:16px;line-height:1.6;color:#1a1c1a;padding-bottom:8px;">${p(copy.intro, lang)}</td></tr>
<tr><td style="padding:0 0 8px 0;"><a href="${escapeHtml(input.sessionUrl)}" style="display:inline-block;background:#c0fa20;color:#0a0b0a;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:4px;">${escapeHtml(copy.cta)}</a></td></tr>
</table></td></tr></table>
${inner}
</body></html>`;
  const text = `${copy.intro}\n\n${copy.cta}: ${input.sessionUrl}\n\n${input.briefText}`;
  return { subject: copy.subject, html, text };
}

/** Founder notification on submission (§6). English only; internal. */
export function founderNotifyEmail(input: {
  name: string;
  email: string;
  phone: string;
  country: string;
  company: string | null;
  language: LabLanguage;
  industry: string | null;
  verdict: string | null;
  weighted: number | null;
  whyLines: string[];
  redFlags: string[];
  adminUrl: string;
  priority: boolean;
}) {
  const title = `${input.priority ? "⚡ PRIORITY · " : ""}New Idea Lab submission — ${input.name}${input.company ? ` (${input.company})` : ""}`;
  const rows: Array<[string, string]> = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Country", input.country],
    ["Language", input.language],
    ["Industry", input.industry ?? "—"],
    ["Verdict", input.verdict ?? "pending"],
    ["Weighted score", input.weighted != null ? input.weighted.toFixed(2) : "—"],
  ];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;">${rows
    .map(([k, v]) => `<tr><td style="color:#6f7a6e;padding:2px 12px 2px 0;">${escapeHtml(k)}</td><td><bdi>${escapeHtml(v)}</bdi></td></tr>`)
    .join("")}</table>`;
  const why = input.whyLines.length
    ? `<p style="margin:16px 0 6px 0;font-weight:600;">Why</p><ul style="margin:0;padding-inline-start:20px;">${input.whyLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
  const flags = input.redFlags.length
    ? `<p style="margin:16px 0 6px 0;font-weight:600;color:#a33;">Red flags</p><ul style="margin:0;padding-inline-start:20px;">${input.redFlags.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
  const shell = emailShell({
    language: "en",
    title,
    bodyHtml: `${table}${why}${flags}<p style="margin:16px 0 0 0;">Nothing has been sent to the visitor. Review the packet and choose an action in the admin.</p>`,
    bodyText: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nWhy:\n${input.whyLines.map((l) => `- ${l}`).join("\n")}\n\nRed flags:\n${input.redFlags.map((l) => `- ${l}`).join("\n") || "none"}\n\nNothing has been sent to the visitor.`,
    cta: { label: "Open in admin", url: input.adminUrl },
  });
  return { subject: title, ...shell };
}

/** Decision emails (§8): plain-text body authored/edited by the admin, wrapped
 *  in the shell. Only whitelisted inputs reach the template. */
export function decisionEmail(input: { language: LabLanguage; subject: string; body: string; ctaLabel?: string; ctaUrl?: string }) {
  const lang = input.language;
  const paragraphs = input.body.split(/\n{2,}/).map((s) => p(s.replace(/\n/g, " "), lang)).join("");
  const shell = emailShell({
    language: lang,
    title: input.subject,
    bodyHtml: paragraphs,
    bodyText: input.body,
    cta: input.ctaUrl && input.ctaLabel ? { label: input.ctaLabel, url: input.ctaUrl } : null,
  });
  return { subject: input.subject, ...shell };
}
