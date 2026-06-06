// Example per-site config. Copy to the site root as `admin.config.ts` and adjust
// the import paths to wherever admin-core lives in that repo.
import { defineAdminConfig } from "../src/config";
import { crmModule } from "../src/modules/crm";

export const adminConfig = defineAdminConfig({
  brand: { name: "ACME ADMIN" },
  // Turn on only the modules this site needs. A blog might use a `posts`
  // module instead; a funnel site uses `crm` (+ `marketing` later).
  modules: [crmModule],
  copilot: { enabled: true },
});
