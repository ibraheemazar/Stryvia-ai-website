import { describe, expect, it } from "vitest";
import { isolateLatin, renderBriefHtml, renderBriefText } from "@/lib/lab/render";
import { briefCopyEmail, decisionEmail, founderNotifyEmail, magicLinkEmail } from "@/lib/lab/emails";
import type { Brief } from "@/lib/lab/schemas";

const brief: Brief = {
  title: "مكتب ترجمة أسرع",
  one_line: "أتمتة الاستلام والتسعير مع مراجعة بشرية",
  what_you_came_with: {
    problem: "الطلبات تأتي عبر WhatsApp وتُسعَّر يدويًا",
    who_is_affected: "3 مترجمين ومديرة المكتب",
    current_process: ["استلام الملف", "عدّ الكلمات في Word", "إرسال عرض السعر"],
    frequency_and_volume: "نحو 40 طلبًا شهريًا",
    cost_today: "ساعتان يوميًا",
    tried_so_far: "جداول Excel",
    tools: "WhatsApp, Word, Excel",
    desired_outcome: "تسعير فوري",
  },
  what_it_could_become: {
    intro: "أفكار استكشفناها معًا",
    automate: "استلام وتسعير آلي",
    add_intelligence: "مسودة أولى بالذكاء الاصطناعي",
    productize: "أداة لمكاتب الترجمة الصغيرة في الخليج",
    scale: "سوق للمترجمين المعتمدين",
    honest_ceiling_note: "السقف يعتمد على عدد المكاتب المشابهة",
  },
  what_you_bring: ["خبرة 12 سنة", "عملاء حاليون"],
  what_you_expect: "شراكة",
  constraints: "<script>alert(1)</script> اعتماد المترجمين",
  next_step_note: "ستراجع سترايفيا وتردّ",
};

describe("brief rendering", () => {
  it("renders Arabic with dir=rtl and isolates Latin fragments", () => {
    const html = renderBriefHtml(brief, { language: "ar", visitorName: "نورة" });
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('dir="rtl" style="direction:rtl');
    expect(html).toContain("<bdi>WhatsApp</bdi>");
    expect(html).toContain("<bdi>40</bdi>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;<bdi>script</bdi>&gt;"); // escaped, entities intact, word isolated
  });

  it("renders English with dir=ltr and no bdi noise", () => {
    const html = renderBriefHtml({ ...brief, title: "Faster translation office" }, { language: "en", visitorName: "Nora" });
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).not.toContain("<bdi>WhatsApp</bdi>");
  });

  it("text version contains every section", () => {
    const text = renderBriefText(brief, "ar");
    expect(text).toContain("ما جئت به");
    expect(text).toContain("ما يمكن أن يصبح");
    expect(text).toContain("1. استلام الملف");
  });

  it("isolateLatin only touches Arabic output", () => {
    expect(isolateLatin("Excel 2", "en")).toBe("Excel 2");
    expect(isolateLatin("برنامج Excel", "ar")).toBe("برنامج <bdi>Excel</bdi>");
  });
});

describe("emails", () => {
  it("magic link email is RTL-correct in Arabic and includes the link once", () => {
    const m = magicLinkEmail({ language: "ar", name: "نورة العلي", url: "https://stryvia.ai/api/lab/auth?token=abc", expiresHours: 168 });
    expect(m.html).toContain('dir="rtl"');
    expect(m.html.match(/token=abc/g)?.length).toBe(1);
    expect(m.text).toContain("token=abc");
    expect(m.subject.length).toBeGreaterThan(5);
  });

  it("founder notification never reaches visitor templates and escapes content", () => {
    const f = founderNotifyEmail({
      name: "<img src=x onerror=alert(1)>",
      email: "a@b.co",
      phone: "+966500000000",
      country: "SA",
      company: null,
      language: "en",
      industry: "clinics",
      verdict: "priority_call",
      weighted: 4.2,
      whyLines: ["one", "two"],
      redFlags: [],
      adminUrl: "https://stryvia.ai/supadmin/lab/x",
      priority: true,
    });
    expect(f.subject).toContain("PRIORITY");
    expect(f.html).not.toContain("<img src=x");
    expect(f.html).toContain("Nothing has been sent to the visitor");
  });

  it("brief copy email embeds the brief body and the session link", () => {
    const html = renderBriefHtml(brief, { language: "ar", visitorName: "نورة" });
    const m = briefCopyEmail({ language: "ar", name: "نورة", briefHtml: html, briefText: "x", responseDays: 7, sessionUrl: "https://stryvia.ai/ar/lab/s/1" });
    expect(m.html).toContain("https://stryvia.ai/ar/lab/s/1");
    expect(m.html).toContain("ما جئت به");
    expect(m.text).toContain("7");
  });

  it("decision email wraps admin text as paragraphs with escaping", () => {
    const d = decisionEmail({ language: "en", subject: "Let's talk", body: "Hi <b>there</b>\n\nSecond paragraph", ctaLabel: "Book", ctaUrl: "https://cal.com/x" });
    expect(d.html).toContain("&lt;b&gt;there&lt;/b&gt;");
    expect(d.html.match(/<p /g)?.length).toBe(2);
    expect(d.html).toContain("https://cal.com/x");
  });
});
