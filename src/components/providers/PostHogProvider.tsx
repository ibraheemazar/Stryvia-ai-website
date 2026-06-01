"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { usePathname } from "next/navigation";
import { getConsent } from "@/lib/consent";
import { captureAttribution } from "@/lib/attribution";

// Behavioural analytics (Decisions §6). Session replay is on but every form
// field is masked, so we never record the personal details a visitor types.
// Loads only when a key is configured, so local dev stays quiet.

let initialised = false;

function initPostHog() {
  if (initialised) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return;
  // Only after the visitor has granted consent for non-essential analytics.
  if (getConsent() !== "granted") return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    capture_pageview: false, // we send page_view manually with locale context
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-sv-mask]",
    },
  });
  initialised = true;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution(); // first-touch attribution, independent of analytics consent
    initPostHog();
    const onChange = () => initPostHog();
    window.addEventListener("sv-consent-change", onChange);
    return () => window.removeEventListener("sv-consent-change", onChange);
  }, []);

  useEffect(() => {
    if (!initialised) return;
    posthog.capture("page_view", { path: pathname });
  }, [pathname]);

  return <>{children}</>;
}
