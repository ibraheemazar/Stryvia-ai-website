// Theme system: a light/dark mode and a small, curated set of accent palettes.
// The defaults (dark + acid green) are the brand's signature; the alternates
// are tuned to stay premium, never garish. Values are applied as data
// attributes on <html> and read back from a cookie so the server can render
// the chosen theme with no flash on reload.

export type ThemeMode = "dark" | "light";
export type AccentId = "acid" | "azure" | "violet" | "ember";

export const THEME_MODES: ThemeMode[] = ["dark", "light"];

export const DEFAULT_MODE: ThemeMode = "dark";
export const DEFAULT_ACCENT: AccentId = "acid";

export const MODE_COOKIE = "sv-mode";
export const ACCENT_COOKIE = "sv-accent";
// One year — this is a durable preference.
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// The swatch hex is only used for the picker dots; the real palette lives in
// CSS (globals.css) keyed by [data-accent].
export const ACCENTS: { id: AccentId; labelKey: string; swatch: string }[] = [
  { id: "acid", labelKey: "acid", swatch: "#c0fa20" },
  { id: "azure", labelKey: "azure", swatch: "#3ba9ff" },
  { id: "violet", labelKey: "violet", swatch: "#b794ff" },
  { id: "ember", labelKey: "ember", swatch: "#ff9f45" },
];

const ACCENT_IDS = new Set<string>(ACCENTS.map((a) => a.id));

export function normalizeMode(value: string | undefined | null): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function normalizeAccent(value: string | undefined | null): AccentId {
  return value && ACCENT_IDS.has(value) ? (value as AccentId) : DEFAULT_ACCENT;
}
