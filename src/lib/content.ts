// Launch capability set (Launch Brief Tier 1). Illustrative entry points, never
// a finite catalog — the page copy frames them as examples. Grown over time
// from the same template.
export const CAPABILITY_SLUGS = [
  "build-a-product-or-app",
  "launch-a-new-venture",
  "creative-and-content-production",
  "marketing-and-growth",
  "operations-and-automation",
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

export type Scenario = {
  title: string;
  problem: string;
  approach: string;
  shape: string;
  ownership: string;
};
