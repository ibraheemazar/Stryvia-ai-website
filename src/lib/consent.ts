"use client";

// Consent for non-essential analytics (Decisions §6 / privacy policy). Essential
// site function never depends on this; only PostHog is gated by it.
const KEY = "sv-consent";

export type Consent = "granted" | "denied" | null;

export function getConsent(): Consent {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "granted" || v === "denied" ? v : null;
}

export function setConsent(value: "granted" | "denied") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, value);
  window.dispatchEvent(new CustomEvent("sv-consent-change", { detail: value }));
}
