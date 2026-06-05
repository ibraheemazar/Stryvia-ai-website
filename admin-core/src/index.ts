// admin-core public surface. Import the chassis from here; import modules from
// their own paths (e.g. ./modules/crm) so a site only pulls in what it enables.

export { defineAdminConfig, DEFAULT_ACCENTS } from "./config";
export type { AdminConfig, AdminAccent } from "./config";

export type { AdminModule, AdminModuleUI, CopilotContextProvider } from "./modules/types";

// UI chassis
export { AdminApp } from "./ui/AdminApp";
export { AdminShell } from "./ui/AdminShell";
export { AdminLogin } from "./ui/AdminLogin";
export { AdminCopilot } from "./ui/AdminCopilot";
export { AdminChat } from "./ui/AdminChat";
export { ThemePicker } from "./ui/ThemePicker";

// Server primitives (import only in route handlers / server components)
export { verifyAdmin, adminAllowlist } from "./auth/verify";
export { getServiceSupabase, requireService, hasSupabase } from "./auth/supabase-server";
export { getBrowserSupabase } from "./auth/supabase-browser";
export { getAnthropic, hasAnthropic, ANTHROPIC_MODEL } from "./ai/anthropic";
export { streamClaude, parseRange, clampMessages } from "./ai/stream";
export type { ChatMessage } from "./ai/stream";
export {
  providerConfigured,
  slackNotify,
  sendWhatsApp,
  sendSMS,
  sendEmail,
  webhookPost,
} from "./connectors";
