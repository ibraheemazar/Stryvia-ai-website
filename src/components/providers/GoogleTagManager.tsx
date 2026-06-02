"use client";

import { useEffect } from "react";
import { getConsent } from "@/lib/consent";

// Google Tag Manager with Consent Mode v2. GTM is the single container: GA4 and
// any ad/marketing pixels are configured in the GTM UI, not in code. Privacy is
// enforced by Consent Mode — every storage type defaults to "denied" before GTM
// loads, and flips to "granted" only when the visitor accepts the consent
// banner. Inert until NEXT_PUBLIC_GTM_ID is set, so nothing loads in dev or
// before a container exists.

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let loaded = false;

function dl(): unknown[] {
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

// Pushes a gtag-style command (array form, read identically to the canonical
// arguments object by GTM's Consent Mode).
function consent(mode: "default" | "update") {
  const granted = getConsent() === "granted";
  const state = granted ? "granted" : "denied";
  dl().push([
    "consent",
    mode,
    {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
      ...(mode === "default" ? { wait_for_update: 500 } : {}),
    },
  ]);
}

function loadGTM(id: string) {
  if (loaded) return;
  loaded = true;
  dl().push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(s);
}

export function GoogleTagManager() {
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_GTM_ID;
    if (!id || typeof window === "undefined") return;
    consent("default"); // must run before GTM loads
    loadGTM(id);
    const onChange = () => consent("update");
    window.addEventListener("sv-consent-change", onChange);
    return () => window.removeEventListener("sv-consent-change", onChange);
  }, []);

  return null;
}
