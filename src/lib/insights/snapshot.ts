import "server-only";
import { getGa4Insights, type Ga4Insights, type Ga4Range } from "./ga4";
import { getMarketingOverview, type Overview } from "@/lib/marketing/data";

// The single source of truth for the analytics deep-dive and the AI advisor:
// GA4 (traffic/behaviour) + first-party funnel (the actual leads/buyers).
// Cached briefly per range to respect GA4 API quota and cut cost/latency.

export type InsightsSnapshot = {
  range: Ga4Range;
  generatedAt: string;
  ga4: Ga4Insights;
  firstParty: Overview | null;
};

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<Ga4Range, { at: number; snapshot: InsightsSnapshot }>();

export async function getInsightsSnapshot(
  range: Ga4Range = "30d",
  opts?: { fresh?: boolean },
): Promise<InsightsSnapshot> {
  const hit = cache.get(range);
  if (!opts?.fresh && hit && Date.now() - hit.at < TTL_MS) return hit.snapshot;

  const [ga4, firstParty] = await Promise.all([getGa4Insights(range), getMarketingOverview()]);
  const snapshot: InsightsSnapshot = {
    range,
    generatedAt: new Date().toISOString(),
    ga4,
    firstParty,
  };
  cache.set(range, { at: Date.now(), snapshot });
  return snapshot;
}
