// Example page wiring. Copy to `app/supadmin/page.tsx` in the site. Pick a
// hard-to-guess route segment; the panel is not linked from the public site.
"use client";

import { AdminApp } from "../src/ui/AdminApp";
import { adminConfig } from "./admin.config";

export default function Page() {
  return <AdminApp config={adminConfig} />;
}
