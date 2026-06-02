// Launch capability set (Launch Brief Tier 1). Illustrative entry points, never
// a finite catalog — the page copy frames them as examples. Grown over time
// from the same template.
export const CAPABILITY_SLUGS = [
  "build-a-product-or-app",
  "launch-a-new-venture",
  "brand-and-identity-creation",
  "creative-and-content-production",
  "advertising-and-campaigns",
  "marketing-and-growth",
  "web-presence-and-seo",
  "content-and-copywriting-at-scale",
  "operations-and-automation",
  "process-and-workflow-design",
  "custom-ai-agents-and-assistants",
  "crm-and-customer-systems",
  "ecommerce-setup-and-optimization",
  "finance-modeling-and-forecasting",
  "strategy-and-business-intelligence",
  "market-and-competitor-research",
  "data-analysis-and-dashboards",
  "sales-enablement-and-pipelines",
  "investor-and-pitch-materials",
  "document-and-contract-drafting",
  "training-and-knowledge-systems",
] as const;

export type CapabilitySlug = (typeof CAPABILITY_SLUGS)[number];

export type Capability = {
  name: string;
  headline: string;
  lead: string;
  problems: string[];
  sub: { label: string; text: string }[];
  approach: string;
  scenarios: string[];
};

// Scenario pool (Decisions §8), surfaced in the Examples gallery and on pages.
export const SCENARIO_SLUGS = [
  "product-no-team",
  "business-unknown-field",
  "campaign-at-scale",
  "manual-process",
  "raise-story-numbers",
  "internal-tool",
  "new-market",
  "idea-carried-for-years",
] as const;

export type Scenario = {
  title: string;
  problem: string;
  approach: string;
  shape: string;
  ownership: string;
};

// Industry layer (Spec §6.4). Illustrative sectors chosen for the regional
// market and search demand; grown over time.
export const INDUSTRY_SLUGS = [
  "real-estate-and-development",
  "food-beverage-and-hospitality",
  "retail-and-ecommerce",
  "media-entertainment-and-production",
  "healthcare",
  "education",
  "professional-services",
  "financial-services",
  "government-and-public-sector",
  "manufacturing-and-logistics",
  "technology-and-startups",
] as const;

export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];

export type Industry = {
  name: string;
  headline: string;
  lead: string;
  problems: string[];
  apply: string;
  scenarios: string[];
  note: string;
};

// Audience "for you" doors (Spec §6.12). Investors have their own gated page.
export const AUDIENCE_SLUGS = [
  "the-visionary",
  "entrepreneurs",
  "operations-leaders",
  "business-owners",
  "domain-newcomers",
  "creatives",
  "marketing-leaders",
  "enterprises",
] as const;

export type AudienceSlug = (typeof AUDIENCE_SLUGS)[number];

export type Audience = {
  name: string;
  headline: string;
  lead: string;
  problems: string[];
  change: string;
  scenarios: string[];
};

// Resources (Spec §6.21): the long-tail SEO + depth engine. Genuine guides,
// each ending in a Chat invitation.
export const ARTICLE_SLUGS = [
  "build-without-a-team",
  "ai-without-an-agency",
  "knowing-the-limits",
  "idea-to-working-product",
  "orchestration-vs-ai-tools",
  "who-owns-what-you-build",
] as const;

export type ArticleSlug = (typeof ARTICLE_SLUGS)[number];

export type Article = {
  title: string;
  lead: string;
  body: string[];
};
