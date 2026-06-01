import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, defaultLocale } from "./routing";

type Dict = Record<string, unknown>;

// Deep-merge overlay onto base (overlay wins where present). Lets a locale ship
// partial translations and fall back to English for anything not yet localized.
function deepMerge(base: Dict, overlay: Dict): Dict {
  const out: Dict = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    const b = out[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      b &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      out[k] = deepMerge(b as Dict, v as Dict);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function catalogs(locale: string): Promise<Dict> {
  const [core, pages, content] = await Promise.all([
    import(`../messages/${locale}.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}.pages.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}.content.json`).then((m) => m.default).catch(() => ({})),
  ]);
  return { ...core, ...pages, ...content };
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // English is the base; the active locale overlays it so any not-yet-translated
  // key falls back gracefully instead of throwing.
  const base = await catalogs(defaultLocale);
  const messages = locale === defaultLocale ? base : deepMerge(base, await catalogs(locale));

  return { locale, messages };
});
