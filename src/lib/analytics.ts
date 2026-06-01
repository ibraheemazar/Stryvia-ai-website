"use client";

import posthog from "posthog-js";

// The funnel events from Decisions §6. Centralised so names never drift.
export type SvEvent =
  | "page_view"
  | "language_switched"
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
}
