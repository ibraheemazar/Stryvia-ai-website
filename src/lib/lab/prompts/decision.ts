import type { LabLanguage } from "@/config/lab.config";

// Decision email drafts (brief §8). Inputs are a strict whitelist — nothing
// from the assessment ever reaches these prompts, so nothing can leak to the
// visitor. The admin edits the draft before anything is sent.

export type DecisionAction = "book_call" | "request_quote" | "decline";

export const DECISION_FROZEN = `You draft short emails from Stryvia to a person who used the Stryvia Idea Lab. A member of Stryvia's team will read, edit and send them, so write in Stryvia's voice: warm, direct, plain, respectful, no hype, no exclamation marks, no corporate filler. Never name a person; the sender is "the Stryvia team". 4–8 short sentences. Never mention scores, assessments, verdicts, ranking, or how the idea compared to others. Remind them in one line that the brief is theirs to keep and use anywhere. Never promise to build anything, never quote prices, never commit to timelines. Refer to their idea by the brief title in their words. Sign off as "The Stryvia team".

Actions:
- book_call: invite them to a call to explore it together; include the scheduling link if given; say what you'd like to discuss in one line.
- request_quote: say the idea reads as a well-defined custom build; ask for the 3–5 concrete details needed to prepare a quote (their exact scope, current tools, users, timing, decision process); no numbers.
- decline: a kind, specific, human decline; thank them; say the brief is theirs to keep and use anywhere; no false hope, no "maybe later" unless asked to leave a door open.

Write in the requested language. Arabic must be natural, warm Gulf Arabic. Output the subject and body only.`;

export function buildDecisionUser(input: {
  action: DecisionAction;
  language: LabLanguage;
  visitorFirstName: string;
  briefTitle: string;
  briefOneLine: string;
  schedulingUrl: string | null;
  adminHint: string | null;
}): string {
  return [
    `ACTION: ${input.action}`,
    `LANGUAGE: ${input.language === "ar" ? "Arabic" : "English"}`,
    `VISITOR FIRST NAME: ${input.visitorFirstName}`,
    `BRIEF TITLE (their words): ${input.briefTitle}`,
    `BRIEF ONE-LINE: ${input.briefOneLine}`,
    input.schedulingUrl ? `SCHEDULING LINK: ${input.schedulingUrl}` : "SCHEDULING LINK: none — ask them for two times that suit them instead",
    input.adminHint ? `REVIEWER'S NOTE FOR THIS DRAFT (follow it): ${input.adminHint}` : null,
    "Draft now.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Deterministic fallback templates used when the model is unavailable. */
export function fallbackDraft(input: {
  action: DecisionAction;
  language: LabLanguage;
  visitorFirstName: string;
  briefTitle: string;
  schedulingUrl: string | null;
}): { subject: string; body: string } {
  const n = input.visitorFirstName;
  const t = input.briefTitle;
  const link = input.schedulingUrl;
  if (input.language === "ar") {
    switch (input.action) {
      case "book_call":
        return {
          subject: `بخصوص «${t}» — هل نتحدث؟`,
          body: `أهلًا ${n}،\n\nقرأنا ملخّصك «${t}» ونودّ أن نتحدث عنه مباشرة.\n\n${link ? `اختر وقتًا يناسبك من هنا: ${link}` : "أرسل لي وقتين يناسبانك هذا الأسبوع."}\n\nهذه دعوة للحديث فقط، ولا التزام على أي طرف بعد.\n\nفريق سترايفيا`,
        };
      case "request_quote":
        return {
          subject: `بخصوص «${t}» — بضعة أسئلة قبل عرض السعر`,
          body: `أهلًا ${n}،\n\nملخّصك «${t}» يقرأ كبناء مخصص واضح الحدود. لنُعدّ لك عرضًا دقيقًا نحتاج بضعة تفاصيل:\n\n- النطاق الأول الذي تريده بالضبط\n- من سيستخدمه ومن يقرّر\n- الأدوات الحالية التي يجب أن يتكامل معها\n- التوقيت الذي تستهدفه\n\nحين تصلنا هذه التفاصيل نرسل لك عرضًا واضحًا.\n\nفريق سترايفيا`,
        };
      default:
        return {
          subject: `بخصوص «${t}» — شكرًا لك`,
          body: `أهلًا ${n}،\n\nشكرًا لوقتك في مختبر الأفكار. قرأنا «${t}» بعناية، ولن تكون سترايفيا الشريك المناسب له في هذه المرحلة.\n\nالملخّص ملكك بالكامل؛ استخدمه مع أي جهة تراها مناسبة.\n\nنتمنى لك التوفيق فيه.\n\nفريق سترايفيا`,
        };
    }
  }
  switch (input.action) {
    case "book_call":
      return {
        subject: `About "${t}" — shall we talk?`,
        body: `Hi ${n},\n\nWe read your brief, "${t}", and we would like to talk it through with you directly.\n\n${link ? `Pick a time that suits you here: ${link}` : "Send us two times that suit you this week."}\n\nThis is an invitation to talk; there is no commitment on either side yet.\n\nThe Stryvia team`,
      };
    case "request_quote":
      return {
        subject: `About "${t}" — a few questions before a quote`,
        body: `Hi ${n},\n\nYour brief, "${t}", reads as a well-defined custom build. To prepare a precise quote we need a few details:\n\n- the exact first scope you want\n- who will use it and who decides\n- the current tools it must work with\n- the timing you are aiming for\n\nOnce we have these we will send you a clear proposal.\n\nThe Stryvia team`,
      };
    default:
      return {
        subject: `About "${t}" — thank you`,
        body: `Hi ${n},\n\nThank you for the time you put into the Idea Lab. We read "${t}" carefully, and Stryvia is not the right partner for it at this stage.\n\nThe brief is yours to keep and to use with anyone you choose.\n\nWe wish you well with it.\n\nThe Stryvia team`,
      };
  }
}
