import type { ComponentType } from "react";

// A module is a self-contained slice of the admin panel. The chassis (auth,
// shell, theme, copilot, connectors) is identical on every site; everything
// site-specific lives in a module that a site opts into via admin.config.ts.
//
// A module has up to four parts:
//   1. UI        — a nav label + a component rendered when the tab is active.
//   2. API       — route handlers mounted under /api/admin/<id>/* (wired by the
//                  host app; each handler must call verifyAdmin first).
//   3. SQL       — schema.sql run against the site's Supabase project.
//   4. Copilot   — an optional server fn returning facts to ground the copilot.
//
// Only the UI part is needed to render the shell; the rest are conventions the
// host app wires up (see modules/crm for the full pattern).

export interface AdminModuleUI {
  /** Stable id, also the API namespace: /api/admin/<id>/... */
  id: string;
  /** Nav tab label. */
  label: string;
  /** Rendered when this tab is active. Receives the admin access token. */
  Component: ComponentType<{ token: string }>;
}

export type AdminModule = AdminModuleUI;

// ---------------------------------------------------------------------------
// Server-side helpers a module's API routes use. These are not imported by the
// client bundle.
// ---------------------------------------------------------------------------

/** Optional copilot grounding: return a compact, human-readable fact sheet. */
export type CopilotContextProvider = (range: string) => Promise<string>;
