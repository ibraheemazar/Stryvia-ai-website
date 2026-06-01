import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { CAPABILITY_SLUGS } from "@/lib/content";

// Bilingual sitemap with hreflang alternates per path (Spec §8 technical SEO).
const PATHS = [
  "",
  "/how-it-works",
  "/capabilities",
  ...CAPABILITY_SLUGS.map((s) => `/capabilities/${s}`),
  "/intelligence",
  "/solution-finder",
  "/estimate",
  "/trust",
  "/pricing",
  "/manifesto",
  "/faq",
  "/start",
  "/early-access",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://stryvia.ai";
  const url = (locale: string, path: string) =>
    locale === routing.defaultLocale ? `${base}${path}` : `${base}/${locale}${path}`;

  return PATHS.map((path) => ({
    url: url(routing.defaultLocale, path),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])),
    },
  }));
}
