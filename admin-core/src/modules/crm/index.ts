import type { AdminModule } from "../types";
import { CrmDashboard } from "./CrmDashboard";

// The CRM module: conversation inbox, lead scoring, transcript search. Enabled
// on sites that have a chat -> lead funnel.
//
// To wire it into a site:
//   1. Run modules/crm/schema.sql against the site's Supabase project.
//   2. Add the route GET /api/admin/crm/data -> getCrmData (see api.ts).
//   3. Add `crmModule` to the modules array in admin.config.ts.
export const crmModule: AdminModule = {
  id: "crm",
  label: "Leads",
  Component: CrmDashboard,
};

export { getCrmData } from "./api";
export type { ConversationRow, CrmInsights, CrmDataResponse } from "./types";
