// The full catalog of marketing integrations across every channel and tool.
// The Integrations Hub renders from this; each activates when its credentials
// are supplied. `native: true` means it works now on the data/services already
// wired (no external account needed).

export type IntegrationCategory =
  | "internal"
  | "advertising"
  | "social"
  | "messaging"
  | "email"
  | "seo"
  | "analytics"
  | "automation";

export type IntegrationDef = {
  provider: string;
  name: string;
  category: IntegrationCategory;
  blurb: string;
  native?: boolean;
  envHint?: string; // what unlocks it
};

export const INTEGRATIONS: IntegrationDef[] = [
  // Internal — already powering the dashboard
  { provider: "stryvia_chat", name: "Stryvia Chat (first-party)", category: "internal", native: true, blurb: "Every conversation is your sharpest signal: what the market is asking for, in their words." },
  { provider: "supabase", name: "Supabase", category: "internal", native: true, blurb: "Conversations, leads, segments, content, automations — your owned data." },
  { provider: "posthog", name: "PostHog", category: "analytics", native: true, blurb: "Funnel, behaviour, and session replay. Powers the live funnel.", envHint: "NEXT_PUBLIC_POSTHOG_KEY" },
  { provider: "ses", name: "Amazon SES", category: "email", native: true, blurb: "Send campaigns and lifecycle email to your segments.", envHint: "SES_* env vars" },
  { provider: "anthropic", name: "Stryvia Intelligence (Claude)", category: "internal", native: true, blurb: "Generates on-brand content and growth recommendations.", envHint: "ANTHROPIC_API_KEY" },

  // Advertising
  { provider: "google_ads", name: "Google Ads", category: "advertising", blurb: "Search & PMax: campaigns, RSAs, automated bidding, conversion import.", envHint: "Google Ads API OAuth" },
  { provider: "meta_ads", name: "Meta Ads (Facebook/Instagram)", category: "advertising", blurb: "Campaigns, audiences, retargeting, lookalikes, auto creative tests.", envHint: "Meta Marketing API token" },
  { provider: "tiktok_ads", name: "TikTok Ads", category: "advertising", blurb: "Video campaigns and audiences for a younger, fast-growing audience.", envHint: "TikTok Business API" },
  { provider: "snapchat_ads", name: "Snapchat Ads", category: "advertising", blurb: "High-reach channel in the Kingdom and the Gulf.", envHint: "Snap Marketing API" },
  { provider: "linkedin_ads", name: "LinkedIn Ads", category: "advertising", blurb: "B2B reach for enterprise and investor audiences.", envHint: "LinkedIn Marketing API" },
  { provider: "x_ads", name: "X Ads", category: "advertising", blurb: "Conversation-driven reach and retargeting.", envHint: "X Ads API" },

  // Organic social
  { provider: "instagram", name: "Instagram", category: "social", blurb: "Schedule, auto-publish, and community replies.", envHint: "Meta Graph API" },
  { provider: "linkedin_page", name: "LinkedIn Page", category: "social", blurb: "Thought-leadership scheduling and engagement.", envHint: "LinkedIn API" },
  { provider: "x_org", name: "X (organic)", category: "social", blurb: "Scheduling and social listening.", envHint: "X API" },
  { provider: "tiktok_org", name: "TikTok (organic)", category: "social", blurb: "Short-form publishing and trends.", envHint: "TikTok API" },
  { provider: "youtube", name: "YouTube", category: "social", blurb: "Video publishing and SEO.", envHint: "YouTube Data API" },

  // Messaging — critical in KSA/Gulf
  { provider: "whatsapp", name: "WhatsApp Business", category: "messaging", blurb: "Broadcasts and automated conversational flows — the dominant channel here.", envHint: "WhatsApp Cloud API / Unifonic" },
  { provider: "sms", name: "SMS", category: "messaging", blurb: "Transactional and campaign SMS.", envHint: "Unifonic / Twilio" },

  // SEO & analytics
  { provider: "search_console", name: "Google Search Console", category: "seo", blurb: "Rankings, queries, coverage, and content-gap discovery.", envHint: "Search Console API" },
  { provider: "ga4", name: "Google Analytics 4", category: "analytics", blurb: "Cross-channel sessions and conversions.", envHint: "GA4 Data API" },
  { provider: "gtm", name: "Google Tag Manager", category: "analytics", blurb: "Tag and pixel management.", envHint: "GTM container" },

  // Automation / ops
  { provider: "zapier", name: "Zapier / Webhooks", category: "automation", blurb: "Connect anything not natively supported.", envHint: "Webhook URL" },
  { provider: "slack", name: "Slack", category: "automation", blurb: "Real-time alerts and lead notifications.", envHint: "Slack webhook" },
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  internal: "Owned & native",
  advertising: "Advertising",
  social: "Organic social",
  messaging: "Messaging",
  email: "Email",
  seo: "SEO",
  analytics: "Analytics",
  automation: "Automation",
};
