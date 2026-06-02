"use client";

import posthog from "posthog-js";

// The funnel events from Decisions §6. Centralised so names never drift.
export type SvEvent =
  | "page_view"
  | "language_switched"
  | "theme_changed"
  | "chat_opened"
  | "chat_first_message"
  | "chat_scope_returned"
  | "chat_muscle_shown"
  | "chat_cta_shown"
  | "lead_started"
  | "lead_submitted"
  | "early_access_submitted"
  | "chat_escalated_to_human"
  | "capability_viewed"
  | "industry_viewed"
  | "scenario_viewed"
  | "solution_finder_started"
  | "solution_finder_completed"
  | "estimator_used"
  | "intelligence_explored";

export function track(event: SvEvent, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the experience.
  }
  // Mirror into the GTM dataLayer so the same funnel events can drive GA4
  // events and Google/Meta Ads conversions, configured in the GTM UI without a
  // code change. Consent is enforced upstream by Consent Mode (GTM only fires
  // tags once analytics/ads consent is granted), so this push is always safe.
  try {
    const w = window as Window & { dataLayer?: unknown[] };
    if (w.dataLayer) w.dataLayer.push({ event, ...properties });
  } catch {
    // Never break the experience.
  }
}
