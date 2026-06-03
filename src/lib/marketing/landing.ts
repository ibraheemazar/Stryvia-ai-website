import "server-only";
import { getServiceSupabase } from "@/lib/supabase";

// Landing-page + A/B engine. Pages have weighted variants; visitors are assigned
// a sticky variant; views and conversions are recorded and aggregated into
// results with conversion rate and uplift vs the control.

export type Variant = {
  id: string;
  label: string;
  weight: number;
  eyebrow?: string;
  headline: string;
  subhead?: string;
  body?: string;
  ctaText: string;
};

export type LandingPage = {
  id: string;
  slug: string;
  name: string;
  locale: string;
  status: "draft" | "published" | "archived";
  goal: string | null;
  variants: Variant[];
  created_at: string;
  updated_at: string;
};

export async function getPublishedPage(slug: string): Promise<LandingPage | null> {
  const svc = getServiceSupabase();
  if (!svc) return null;
  const { data } = await svc
    .from("landing_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as LandingPage) ?? null;
}

// Weighted, deterministic-by-seed variant selection (seed = sticky cookie).
export function pickVariant(variants: Variant[], seed: number): Variant | null {
  const active = variants.filter((v) => (v.weight ?? 0) > 0);
  if (active.length === 0) return variants[0] ?? null;
  const total = active.reduce((s, v) => s + v.weight, 0);
  let point = (seed % 100000) / 100000 * total;
  for (const v of active) {
    point -= v.weight;
    if (point <= 0) return v;
  }
  return active[active.length - 1];
}

export async function recordEvent(slug: string, variantId: string, kind: "view" | "conversion") {
  const svc = getServiceSupabase();
  if (!svc) return;
  try {
    await svc.from("experiment_events").insert({ page_slug: slug, variant_id: variantId, kind });
  } catch (err) {
    console.error("[stryvia] experiment event failed:", err);
  }
}

export type VariantResult = {
  variantId: string;
  label: string;
  views: number;
  conversions: number;
  rate: number;
  uplift: number | null;
  // Statistical confidence the variant differs from the control (0–100). Null
  // for the control itself or when there isn't enough data yet.
  confidence: number | null;
  winner: boolean;
};

// Standard normal CDF via an erf approximation (Abramowitz & Stegun 7.1.26).
function normalCdf(z: number): number {
  const x = z / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  const erf = x >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

// Two-proportion z-test → two-sided confidence the variant differs from control.
function confidenceVsControl(
  cConv: number,
  cViews: number,
  vConv: number,
  vViews: number,
): number | null {
  if (cViews < 30 || vViews < 30) return null; // too little data to claim anything
  const p = (cConv + vConv) / (cViews + vViews);
  const se = Math.sqrt(p * (1 - p) * (1 / cViews + 1 / vViews));
  if (se === 0) return null;
  const z = Math.abs(vConv / vViews - cConv / cViews) / se;
  return Math.max(0, Math.min(100, Math.round((2 * normalCdf(z) - 1) * 100)));
}

export async function getResults(page: LandingPage): Promise<VariantResult[]> {
  const svc = getServiceSupabase();
  if (!svc) return [];
  const { data } = await svc
    .from("experiment_events")
    .select("variant_id, kind")
    .eq("page_slug", page.slug)
    .limit(100000);
  const rows = data ?? [];

  const agg: Record<string, { views: number; conversions: number }> = {};
  for (const v of page.variants) agg[v.id] = { views: 0, conversions: 0 };
  for (const r of rows) {
    agg[r.variant_id] ??= { views: 0, conversions: 0 };
    if (r.kind === "view") agg[r.variant_id].views++;
    else agg[r.variant_id].conversions++;
  }

  const control = page.variants[0];
  const ctl = control ? agg[control.id] ?? { views: 0, conversions: 0 } : { views: 0, conversions: 0 };
  const controlRate = ctl.views ? ctl.conversions / ctl.views : 0;

  const results = page.variants.map((v) => {
    const a = agg[v.id] || { views: 0, conversions: 0 };
    const rate = a.views ? a.conversions / a.views : 0;
    const isControl = v.id === control?.id;
    return {
      variantId: v.id,
      label: v.label,
      views: a.views,
      conversions: a.conversions,
      rate: Math.round(rate * 1000) / 10,
      uplift: isControl || !controlRate ? null : Math.round(((rate - controlRate) / controlRate) * 1000) / 10,
      confidence: isControl ? null : confidenceVsControl(ctl.conversions, ctl.views, a.conversions, a.views),
      winner: false,
    };
  });

  // Declare a winner only at ≥95% confidence with a positive lift over control.
  const best = results
    .filter((r) => r.confidence !== null && r.confidence >= 95 && (r.uplift ?? 0) > 0)
    .sort((x, y) => y.rate - x.rate)[0];
  if (best) best.winner = true;

  return results;
}
