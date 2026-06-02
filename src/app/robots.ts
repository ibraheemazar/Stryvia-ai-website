import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://stryvia.ai";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The gated investor surface stays out of the index. The admin is kept
        // out via a noindex meta tag (in its layout) rather than listed here —
        // publishing its path in robots.txt would defeat keeping it unguessable.
        disallow: ["/api/", "/investors"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
