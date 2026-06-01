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
};

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
  const controlRate =
    control && agg[control.id]?.views ? agg[control.id].conversions / agg[control.id].views : 0;

  return page.variants.map((v) => {
    const a = agg[v.id] || { views: 0, conversions: 0 };
    const rate = a.views ? a.conversions / a.views : 0;
    return {
      variantId: v.id,
      label: v.label,
      views: a.views,
      conversions: a.conversions,
      rate: Math.round(rate * 1000) / 10,
      uplift:
        v.id === control?.id || !controlRate
          ? null
          : Math.round(((rate - controlRate) / controlRate) * 1000) / 10,
    };
  });
}
