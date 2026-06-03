import "server-only";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "@/lib/anthropic";
import { BRAND_GUARDRAIL } from "./brand";
import { getLatestLearning } from "./learnings";
import { getMarketingOverview } from "./data";

// AI marketing assistants: turn a one-line goal into ready-to-review email copy,
// automations, and landing experiments. Everything runs on Stryvia Intelligence
// (Claude) with the brand guardrail, and is grounded in the real conversation
// learnings so the output speaks to actual demand — not generic filler.

function textOf(res: { content: { type: string }[] }): string {
  const block = res.content.find((b) => b.type === "text") as { text?: string } | undefined;
  return block?.text ?? "";
}

function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

// A compact, real-demand context the models can ground in: top requests,
// friction, and the headline takeaway from the latest unified learnings.
async function learningContext(): Promise<string> {
  const row = await getLatestLearning();
  const p = (row?.payload ?? {}) as {
    summary?: string;
    topRequests?: { request: string; count: number }[];
    friction?: string[];
  };
  const parts: string[] = [];
  if (p.summary) parts.push(`Headline: ${p.summary}`);
  if (p.topRequests?.length)
    parts.push(`Top requests: ${p.topRequests.slice(0, 8).map((r) => `${r.request} (${r.count})`).join("; ")}`);
  if (p.friction?.length) parts.push(`Friction: ${p.friction.slice(0, 6).join("; ")}`);
  return parts.length
    ? `REAL AUDIENCE INTELLIGENCE (ground your output in this):\n${parts.join("\n")}`
    : "No learnings yet — write from the brand and the brief.";
}

const LOCALE_NOTE = (locale?: string) =>
  locale === "ar"
    ? "Write in natural, idiomatic Gulf Arabic."
    : locale === "fr"
      ? "Write in natural French."
      : "Write in English.";

// ---------------------------------------------------------------- Email copy
export async function draftEmail(args: {
  brief: string;
  category?: string;
  converted?: boolean;
  tone?: string;
  locale?: string;
}): Promise<{ subjects: string[]; body: string } | null> {
  if (!hasAnthropic()) return null;
  const ctx = await learningContext();
  const audience = [
    args.category ? `category: ${args.category}` : null,
    args.converted ? "converted leads" : "all leads",
  ]
    .filter(Boolean)
    .join(", ");

  try {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      system:
        `${BRAND_GUARDRAIL}\n\n${ctx}\n\n` +
        `You write a marketing email for the audience (${audience}). ${LOCALE_NOTE(args.locale)} ` +
        `${args.tone ? `Tone: ${args.tone}. ` : ""}Reply ONLY with JSON: ` +
        '{"subjects": string[] (3 distinct subject lines, <60 chars each), "body": string ' +
        "(the email body, plain text, no greeting placeholders that look unfinished)}. " +
        "Speak to the real demand above. No code fences.",
      messages: [{ role: "user", content: args.brief.slice(0, 2000) || "Write a strong outreach email." }],
    });
    const parsed = JSON.parse(stripFences(textOf(res))) as { subjects?: unknown; body?: unknown };
    const subjects = Array.isArray(parsed.subjects)
      ? parsed.subjects.map((s) => String(s).slice(0, 140)).filter(Boolean).slice(0, 3)
      : [];
    const body = String(parsed.body ?? "").slice(0, 8000);
    if (!body || subjects.length === 0) return null;
    return { subjects, body };
  } catch (err) {
    console.error("[stryvia] draftEmail failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------- Automation
export type AutomationSpec = {
  name: string;
  trigger: { event: string; filters: { category?: string } };
  actions: { type: string; params: Record<string, unknown> }[];
  rationale?: string;
};

const ACTION_TYPES = ["send_email", "send_whatsapp", "send_sms", "slack_notify", "set_lead_status"];

function normalizeAutomation(raw: Record<string, unknown>): AutomationSpec | null {
  const name = String(raw.name ?? "").slice(0, 120);
  if (!name) return null;
  const trig = (raw.trigger ?? {}) as { event?: string; filters?: { category?: string } };
  const rawActions = Array.isArray(raw.actions) ? raw.actions : [];
  const actions = rawActions
    .map((a) => a as { type?: string; params?: Record<string, unknown> })
    .filter((a) => a.type && ACTION_TYPES.includes(a.type))
    .map((a) => ({ type: a.type as string, params: (a.params ?? {}) as Record<string, unknown> }))
    .slice(0, 6);
  if (actions.length === 0) return null;
  return {
    name,
    trigger: {
      event: "lead_created",
      filters: trig.filters?.category ? { category: String(trig.filters.category) } : {},
    },
    actions,
    rationale: raw.rationale ? String(raw.rationale).slice(0, 300) : undefined,
  };
}

const AUTOMATION_SCHEMA =
  'JSON: {"name": string, "trigger": {"event": "lead_created", "filters": {"category"?: string}}, ' +
  '"actions": [{"type": "send_email"|"send_whatsapp"|"send_sms"|"slack_notify"|"set_lead_status", ' +
  '"params": object}], "rationale": string}. For send_email params use {subject, body} with the ' +
  "copy fully written; for send_whatsapp/send_sms/slack_notify use {message}; for set_lead_status " +
  "use {status}. Write all message copy on-brand and grounded in the real demand. No code fences.";

export async function buildAutomation(goal: string): Promise<AutomationSpec | null> {
  if (!hasAnthropic() || !goal.trim()) return null;
  const ctx = await learningContext();
  try {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      system:
        `${BRAND_GUARDRAIL}\n\n${ctx}\n\n` +
        "You design a marketing automation from a plain-English goal. The trigger fires when a new " +
        "lead matches an optional problem category. Reply ONLY with " +
        AUTOMATION_SCHEMA,
      messages: [{ role: "user", content: goal.slice(0, 1000) }],
    });
    return normalizeAutomation(JSON.parse(stripFences(textOf(res))));
  } catch (err) {
    console.error("[stryvia] buildAutomation failed:", err);
    return null;
  }
}

export async function suggestAutomations(): Promise<AutomationSpec[]> {
  if (!hasAnthropic()) return [];
  const [ctx, overview] = await Promise.all([learningContext(), getMarketingOverview()]);
  try {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1600,
      system:
        `${BRAND_GUARDRAIL}\n\n${ctx}\n\n` +
        "Propose the 3 highest-leverage marketing automations for this funnel. Reply ONLY with a JSON " +
        'array of objects, each ' +
        AUTOMATION_SCHEMA,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ funnel: overview?.funnel, byCategory: overview?.byCategory?.slice(0, 8) }),
        },
      ],
    });
    const arr = JSON.parse(stripFences(textOf(res)));
    if (!Array.isArray(arr)) return [];
    return arr.map((a) => normalizeAutomation(a)).filter((a): a is AutomationSpec => !!a).slice(0, 3);
  } catch (err) {
    console.error("[stryvia] suggestAutomations failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------- Landing A/B
export type VariantSpec = {
  label: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  body: string;
  ctaText: string;
};

export async function generateExperiment(args: {
  goal: string;
  locale?: string;
  category?: string;
}): Promise<{ hypothesis: string; variants: VariantSpec[] } | null> {
  if (!hasAnthropic()) return null;
  const ctx = await learningContext();
  try {
    const res = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1600,
      system:
        `${BRAND_GUARDRAIL}\n\n${ctx}\n\n` +
        `You design a two-variant landing-page A/B test. ${LOCALE_NOTE(args.locale)} The two variants must ` +
        "take GENUINELY DIFFERENT positioning angles (e.g. outcome-led vs speed/cost-led) so the test " +
        "learns something. Reply ONLY with JSON: " +
        '{"hypothesis": string (one line: what this test learns), "variants": [{"label": "A", ' +
        '"eyebrow": string, "headline": string, "subhead": string, "body": string (1-3 short ' +
        'paragraphs), "ctaText": string}, {"label": "B", ...}]}. Ground both in the real demand above. ' +
        "No code fences.",
      messages: [
        {
          role: "user",
          content: `Goal: ${args.goal.slice(0, 800)}${args.category ? `\nAudience category: ${args.category}` : ""}`,
        },
      ],
    });
    const parsed = JSON.parse(stripFences(textOf(res))) as {
      hypothesis?: string;
      variants?: Record<string, unknown>[];
    };
    const variants = (parsed.variants ?? []).slice(0, 2).map((v, i) => ({
      label: String(v.label ?? String.fromCharCode(65 + i)).slice(0, 8),
      eyebrow: String(v.eyebrow ?? "").slice(0, 120),
      headline: String(v.headline ?? "").slice(0, 200),
      subhead: String(v.subhead ?? "").slice(0, 300),
      body: String(v.body ?? "").slice(0, 2000),
      ctaText: String(v.ctaText ?? "Start a conversation").slice(0, 60),
    }));
    if (variants.length < 2 || !variants[0].headline) return null;
    return { hypothesis: String(parsed.hypothesis ?? "").slice(0, 300), variants };
  } catch (err) {
    console.error("[stryvia] generateExperiment failed:", err);
    return null;
  }
}
