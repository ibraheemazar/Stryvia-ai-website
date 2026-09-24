// Boot-time environment validation (production-readiness §5). Runs once per
// server instance. A misconfigured Lab disables itself with a clear log line;
// it never crashes the rest of the site.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getLabSettings } = await import("@/lib/lab/env");
  const s = getLabSettings();
  const line = (level: string, event: string, extra: Record<string, unknown>) =>
    JSON.stringify({ ts: new Date().toISOString(), level, src: "lab", event, ...extra });
  if (!s.enabled) console.error(line("error", "lab.disabled_at_boot", { reason: s.disabledReason }));
  else console.info(line("info", "lab.ready", { provider: s.aiProvider, mail: s.mailProvider, botProtection: s.turnstile.enabled }));
  for (const w of s.warnings) console.warn(line("warn", "lab.config_warning", { warning: w }));
}
