"use client";

// First-touch attribution. Captured once on first visit and kept in a cookie so
// the conversation a visitor eventually starts is attributed to the source that
// brought them. Sent with the Chat request and stored on the conversation.

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_path?: string;
};

const COOKIE = "sv_attr";

export function captureAttribution() {
  if (typeof window === "undefined") return;
  if (document.cookie.includes(`${COOKIE}=`)) return; // first-touch only

  const params = new URLSearchParams(window.location.search);
  const attr: Attribution = {
    utm_source: params.get("utm_source") || undefined,
    utm_medium: params.get("utm_medium") || undefined,
    utm_campaign: params.get("utm_campaign") || undefined,
    referrer: document.referrer ? new URL(document.referrer).hostname : undefined,
    landing_path: window.location.pathname,
  };
  // Only store if there's something meaningful (or to lock first-touch as direct).
  try {
    const v = encodeURIComponent(JSON.stringify(attr));
    document.cookie = `${COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function getAttribution(): Attribution {
  if (typeof document === "undefined") return {};
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match.split("=")[1])) as Attribution;
  } catch {
    return {};
  }
}
