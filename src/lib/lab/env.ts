import "server-only";
import { z } from "zod";
import {
  LAB_CONSENT_VERSION,
  LAB_EFFORT,
  LAB_LIMITS,
  LAB_MODELS,
  LAB_RESPONSE_DAYS,
  type LabModelRole,
} from "@/config/lab.config";

// Lab environment validation (brief §9). Validated once at boot from
// `instrumentation.ts` and on first use. A missing REQUIRED value never crashes
// the site: it disables the Lab with a friendly page and an `error` log.

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const intOr = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseInt(v, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : fallback;
    });

const numOr = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number.parseFloat(v) : NaN;
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    });

const optStr = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined));

export const LabEnvSchema = z.object({
  // Upstream services the Lab depends on
  ANTHROPIC_API_KEY: optStr,
  NEXT_PUBLIC_SUPABASE_URL: optStr,
  SUPABASE_SERVICE_ROLE_KEY: optStr,
  NEXT_PUBLIC_SITE_URL: optStr,
  LEAD_NOTIFY_TO: optStr,
  LEAD_NOTIFY_FROM: optStr,
  SES_REGION: optStr,
  SES_ACCESS_KEY_ID: optStr,
  SES_SECRET_ACCESS_KEY: optStr,
  VERCEL_ENV: optStr,
  NODE_ENV: optStr,

  // Lab switches and secrets
  LAB_ENABLED: z.string().optional().transform((v) => v === undefined || v === "" || v === "true" || v === "1"),
  LAB_COOKIE_SECRET: optStr,
  LAB_AI_PROVIDER: z.enum(["anthropic", "mock"]).optional().default("anthropic"),
  LAB_MAIL_PROVIDER: z.enum(["ses", "log"]).optional().default("ses"),
  LAB_TURNSTILE_DISABLED: bool,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optStr,
  TURNSTILE_SECRET_KEY: optStr,
  LAB_NOTIFY_TO: optStr,
  LAB_NOTIFY_WHATSAPP_TO: optStr,
  LAB_SCHEDULING_URL: optStr,
  LAB_RESPONSE_DAYS: intOr(LAB_RESPONSE_DAYS),
  LAB_RETENTION_MONTHS: intOr(LAB_LIMITS.retentionMonths),
  LAB_MAX_SESSIONS_PER_EMAIL_PER_DAY: intOr(LAB_LIMITS.startPerEmailPerDay),
  LAB_MONTHLY_SPEND_ALERT_USD: numOr(LAB_LIMITS.monthlySpendAlertUsd),
  LAB_MONTHLY_SPEND_HARD_CAP_USD: numOr(LAB_LIMITS.monthlySpendHardCapUsd),
  LAB_HARNESS_BUDGET_USD: numOr(40),

  // Model overrides
  LAB_MODEL_INTERVIEW: optStr,
  LAB_MODEL_EXTRACT: optStr,
  LAB_MODEL_BRIEF: optStr,
  LAB_MODEL_ASSESS: optStr,
  LAB_MODEL_DRAFT: optStr,
  LAB_MODEL_JUDGE: optStr,

  // Voice
  LAB_STT_PROVIDER: z.enum(["browser", "elevenlabs", "openai", "azure"]).optional().default("browser"),
  ELEVENLABS_API_KEY: optStr,
  OPENAI_API_KEY: optStr,
  AZURE_SPEECH_KEY: optStr,
  AZURE_SPEECH_REGION: optStr,
});

export type LabEnv = z.infer<typeof LabEnvSchema>;

export type LabSettings = {
  enabled: boolean;
  /** Why the Lab is disabled, if it is. */
  disabledReason: string | null;
  isProduction: boolean;
  siteUrl: string;
  cookieSecret: string | null;
  aiProvider: "anthropic" | "mock";
  mailProvider: "ses" | "log";
  turnstile: { enabled: boolean; siteKey?: string; secretKey?: string };
  notifyTo: string | undefined;
  notifyWhatsAppTo: string | undefined;
  schedulingUrl: string | undefined;
  responseDays: number;
  retentionMonths: number;
  maxSessionsPerEmailPerDay: number;
  monthlySpendAlertUsd: number;
  monthlySpendHardCapUsd: number;
  harnessBudgetUsd: number;
  consentVersion: string;
  models: Record<LabModelRole, string>;
  effort: typeof LAB_EFFORT;
  stt: {
    provider: "browser" | "elevenlabs" | "openai" | "azure";
    elevenlabsKey?: string;
    openaiKey?: string;
    azureKey?: string;
    azureRegion?: string;
  };
  /** Problems worth logging as warnings (optional integrations missing). */
  warnings: string[];
};

let cached: LabSettings | null = null;

export function resetLabSettingsForTests() {
  cached = null;
}

export function getLabSettings(env: NodeJS.ProcessEnv = process.env): LabSettings {
  if (cached && env === process.env) return cached;

  const parsed = LabEnvSchema.safeParse(env);
  const e: LabEnv = parsed.success ? parsed.data : LabEnvSchema.parse({});
  const isProduction = e.VERCEL_ENV === "production" || (!e.VERCEL_ENV && e.NODE_ENV === "production");

  const problems: string[] = [];
  const warnings: string[] = [];
  if (!parsed.success) problems.push(`invalid env: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  if (!e.LAB_ENABLED) problems.push("LAB_ENABLED is false");
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) problems.push("Supabase is not configured");
  if (e.LAB_AI_PROVIDER === "anthropic" && !e.ANTHROPIC_API_KEY) problems.push("ANTHROPIC_API_KEY is missing");
  if (e.LAB_AI_PROVIDER === "mock" && isProduction) problems.push("LAB_AI_PROVIDER=mock is not allowed in production");
  if (isProduction && !e.LAB_COOKIE_SECRET) problems.push("LAB_COOKIE_SECRET is required in production");

  // Cookie secret: production requires the real secret; elsewhere derive one
  // from the service key so local/preview work without another setup step.
  let cookieSecret: string | null = e.LAB_COOKIE_SECRET ?? null;
  if (!cookieSecret && !isProduction && e.SUPABASE_SERVICE_ROLE_KEY) {
    cookieSecret = `derived:${e.SUPABASE_SERVICE_ROLE_KEY}`;
    warnings.push("LAB_COOKIE_SECRET missing — using a derived dev secret");
  }

  const turnstileKeys = Boolean(e.NEXT_PUBLIC_TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY);
  const turnstileEnabled = turnstileKeys && !e.LAB_TURNSTILE_DISABLED;
  if (!turnstileEnabled) {
    if (isProduction && !e.LAB_TURNSTILE_DISABLED) {
      problems.push("Turnstile keys missing — set them or set LAB_TURNSTILE_DISABLED=true explicitly");
    } else {
      warnings.push("Bot protection (Turnstile) is off — rate limits and honeypot only");
    }
  }

  const sesConfigured = Boolean(e.SES_REGION && e.SES_ACCESS_KEY_ID && e.SES_SECRET_ACCESS_KEY && e.LEAD_NOTIFY_FROM);
  if (e.LAB_MAIL_PROVIDER === "ses" && !sesConfigured) {
    warnings.push("SES not configured — magic links and brief copies will be logged, not sent");
  }
  if (!e.LAB_SCHEDULING_URL) warnings.push("LAB_SCHEDULING_URL missing — 'Book a call' emails will omit the link");

  const notifyTo = e.LAB_NOTIFY_TO ?? e.LEAD_NOTIFY_TO;
  if (!notifyTo) warnings.push("LAB_NOTIFY_TO / LEAD_NOTIFY_TO missing — founder notifications disabled");

  const models: Record<LabModelRole, string> = {
    ...LAB_MODELS,
    interview: e.LAB_MODEL_INTERVIEW ?? LAB_MODELS.interview,
    extract: e.LAB_MODEL_EXTRACT ?? LAB_MODELS.extract,
    brief: e.LAB_MODEL_BRIEF ?? LAB_MODELS.brief,
    assess: e.LAB_MODEL_ASSESS ?? LAB_MODELS.assess,
    draft: e.LAB_MODEL_DRAFT ?? LAB_MODELS.draft,
    judge: e.LAB_MODEL_JUDGE ?? LAB_MODELS.judge,
  };

  const settings: LabSettings = {
    enabled: problems.length === 0,
    disabledReason: problems.length ? problems.join("; ") : null,
    isProduction,
    siteUrl: (e.NEXT_PUBLIC_SITE_URL ?? "https://stryvia.ai").replace(/\/$/, ""),
    cookieSecret,
    aiProvider: e.LAB_AI_PROVIDER,
    mailProvider: sesConfigured ? e.LAB_MAIL_PROVIDER : "log",
    turnstile: {
      enabled: turnstileEnabled,
      siteKey: e.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      secretKey: e.TURNSTILE_SECRET_KEY,
    },
    notifyTo,
    notifyWhatsAppTo: e.LAB_NOTIFY_WHATSAPP_TO,
    schedulingUrl: e.LAB_SCHEDULING_URL,
    responseDays: e.LAB_RESPONSE_DAYS,
    retentionMonths: e.LAB_RETENTION_MONTHS,
    maxSessionsPerEmailPerDay: e.LAB_MAX_SESSIONS_PER_EMAIL_PER_DAY,
    monthlySpendAlertUsd: e.LAB_MONTHLY_SPEND_ALERT_USD,
    monthlySpendHardCapUsd: e.LAB_MONTHLY_SPEND_HARD_CAP_USD,
    harnessBudgetUsd: e.LAB_HARNESS_BUDGET_USD,
    consentVersion: LAB_CONSENT_VERSION,
    models,
    effort: LAB_EFFORT,
    stt: {
      provider: e.LAB_STT_PROVIDER,
      elevenlabsKey: e.ELEVENLABS_API_KEY,
      openaiKey: e.OPENAI_API_KEY,
      azureKey: e.AZURE_SPEECH_KEY,
      azureRegion: e.AZURE_SPEECH_REGION,
    },
    warnings,
  };

  if (env === process.env) cached = settings;
  return settings;
}
