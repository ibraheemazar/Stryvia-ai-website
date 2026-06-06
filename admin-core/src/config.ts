import type { AdminModule } from "./modules/types";

// Per-site configuration. Each website ships an admin.config.ts that calls
// defineAdminConfig() to name the brand and switch on the modules it needs.

export interface AdminAccent {
  id: string;
  /** Any CSS color; drives the --admin-accent variable. */
  swatch: string;
}

export interface AdminConfig {
  brand: {
    /** Shown in the header and on the login screen, e.g. "ACME ADMIN". */
    name: string;
  };
  /** Modules to enable on this site, in nav order. */
  modules: AdminModule[];
  copilot?: {
    enabled?: boolean;
    /** Defaults to /api/admin/copilot. */
    endpoint?: string;
    seeds?: { label: string; prompt: string }[];
  };
  theme?: {
    accents?: AdminAccent[];
    defaultMode?: "dark" | "light";
    defaultAccent?: string;
  };
}

export const DEFAULT_ACCENTS: AdminAccent[] = [
  { id: "acid", swatch: "#9ef01a" },
  { id: "blue", swatch: "#3b82f6" },
  { id: "violet", swatch: "#8b5cf6" },
  { id: "amber", swatch: "#f59e0b" },
  { id: "rose", swatch: "#f43f5e" },
];

export function defineAdminConfig(config: AdminConfig): AdminConfig {
  return {
    ...config,
    copilot: { enabled: true, endpoint: "/api/admin/copilot", ...config.copilot },
    theme: {
      accents: DEFAULT_ACCENTS,
      defaultMode: "dark",
      defaultAccent: "acid",
      ...config.theme,
    },
  };
}
