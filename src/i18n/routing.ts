import { defineRouting } from "next-intl/routing";

// Trilingual-ready from day one. English and Arabic ship at launch;
// French is added later by appending "fr" here and providing messages/fr.json
// plus the locale metadata below. No re-engineering required.
export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Text direction per locale, consumed by the layout via logical CSS properties
// so the entire interface — including the bracket device — mirrors automatically.
export const localeDirection: Record<string, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  fr: "ltr",
};

// Human-facing names for the persistent language switcher, each in its own script.
export const localeNames: Record<string, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Keep the default locale clean of a prefix (stryvia.ai), prefix the rest
  // (stryvia.ai/ar) so each language is a genuine, indexable surface.
  localePrefix: "as-needed",
});
