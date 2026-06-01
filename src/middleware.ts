import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on all pathnames except API routes, the admin area, Next internals,
  // and static files. The admin is locale-agnostic (English-only internal tool).
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
