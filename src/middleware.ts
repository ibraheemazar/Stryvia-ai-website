import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on all pathnames except API routes, the admin area (/supadmin), the
  // file-based metadata routes (icon/og/twitter images, sitemap, robots), Next
  // internals, and static files. The admin is locale-agnostic (English-only).
  matcher: [
    "/((?!api|supadmin|icon|apple-icon|opengraph-image|twitter-image|sitemap.xml|robots.txt|_next|_vercel|.*\\..*).*)",
  ],
};
