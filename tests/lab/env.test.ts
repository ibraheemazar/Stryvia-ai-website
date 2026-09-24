import { describe, expect, it } from "vitest";
import { getLabSettings } from "@/lib/lab/env";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
  ANTHROPIC_API_KEY: "sk-ant-test",
  LAB_COOKIE_SECRET: "secret",
};

describe("lab env validation", () => {
  it("is enabled with the minimum configuration in preview", () => {
    const s = getLabSettings({ ...base, VERCEL_ENV: "preview" } as unknown as NodeJS.ProcessEnv);
    expect(s.enabled).toBe(true);
    expect(s.turnstile.enabled).toBe(false);
    expect(s.warnings.join(" ")).toMatch(/Turnstile/);
  });

  it("refuses production without an explicit Turnstile decision", () => {
    const s = getLabSettings({ ...base, VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv);
    expect(s.enabled).toBe(false);
    expect(s.disabledReason).toMatch(/Turnstile/);
    const ok = getLabSettings({ ...base, VERCEL_ENV: "production", LAB_TURNSTILE_DISABLED: "true" } as unknown as NodeJS.ProcessEnv);
    expect(ok.enabled).toBe(true);
  });

  it("refuses the mock AI provider and a missing cookie secret in production", () => {
    const mock = getLabSettings({ ...base, VERCEL_ENV: "production", LAB_TURNSTILE_DISABLED: "true", LAB_AI_PROVIDER: "mock" } as unknown as NodeJS.ProcessEnv);
    expect(mock.enabled).toBe(false);
    const noSecret = getLabSettings({ ...base, LAB_COOKIE_SECRET: "", VERCEL_ENV: "production", LAB_TURNSTILE_DISABLED: "true" } as unknown as NodeJS.ProcessEnv);
    expect(noSecret.enabled).toBe(false);
    expect(noSecret.disabledReason).toMatch(/LAB_COOKIE_SECRET/);
  });

  it("derives a dev cookie secret outside production, with a warning", () => {
    const s = getLabSettings({ ...base, LAB_COOKIE_SECRET: "", NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv);
    expect(s.enabled).toBe(true);
    expect(s.cookieSecret).toMatch(/^derived:/);
    expect(s.warnings.join(" ")).toMatch(/LAB_COOKIE_SECRET/);
  });

  it("respects the kill switch and model overrides", () => {
    expect(getLabSettings({ ...base, LAB_ENABLED: "false" } as unknown as NodeJS.ProcessEnv).enabled).toBe(false);
    const s = getLabSettings({ ...base, LAB_MODEL_BRIEF: "claude-opus-5", LAB_RESPONSE_DAYS: "10" } as unknown as NodeJS.ProcessEnv);
    expect(s.models.brief).toBe("claude-opus-5");
    expect(s.models.interview).toBe("claude-sonnet-5");
    expect(s.responseDays).toBe(10);
  });

  it("falls back to log mail when SES is not configured", () => {
    expect(getLabSettings({ ...base } as unknown as NodeJS.ProcessEnv).mailProvider).toBe("log");
    const ses = getLabSettings({ ...base, SES_REGION: "eu-west-1", SES_ACCESS_KEY_ID: "a", SES_SECRET_ACCESS_KEY: "b", LEAD_NOTIFY_FROM: "hello@stryvia.ai" } as unknown as NodeJS.ProcessEnv);
    expect(ses.mailProvider).toBe("ses");
  });
});
