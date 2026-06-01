import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://stryvia.ai";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The admin and the gated investor surface stay out of the index.
        disallow: ["/admin", "/api/", "/investors"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
