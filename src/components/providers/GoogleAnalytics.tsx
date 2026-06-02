"use client";

import { useEffect } from "react";
import { getConsent } from "@/lib/consent";

// Google Analytics 4 (gtag.js). Loads only when a Measurement ID is configured
// AND the visitor has granted analytics consent — mirroring PostHogProvider, so
// GA never loads for visitors who decline. SPA route changes are tracked by
// GA4's Enhanced Measurement (history-based page views), so no manual page_view
// is sent here — avoiding double counting.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialised = false;

function initGA() {
  if (initialised || typeof window === "undefined") return;
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return;
  if (getConsent() !== "granted") return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", id);
  initialised = true;
}

export function GoogleAnalytics() {
  useEffect(() => {
    initGA();
    const onChange = () => initGA();
    window.addEventListener("sv-consent-change", onChange);
    return () => window.removeEventListener("sv-consent-change", onChange);
  }, []);

  return null;
}
