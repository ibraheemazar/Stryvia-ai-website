"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { usePathname } from "next/navigation";

// Behavioural analytics (Decisions §6). Session replay is on but every form
// field is masked, so we never record the personal details a visitor types.
// Loads only when a key is configured, so local dev stays quiet.

let initialised = false;

function initPostHog() {
  if (initialised) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return;

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
    initPostHog();
  }, []);

  useEffect(() => {
    if (!initialised) return;
    posthog.capture("page_view", { path: pathname });
  }, [pathname]);

  return <>{children}</>;
}
