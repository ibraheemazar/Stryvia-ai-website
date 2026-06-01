import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Messages are split across catalogs per locale so large page and content copy
// stays manageable. They are merged into one namespace map at request time.
async function loadMessages(locale: string) {
  const [core, pages, content] = await Promise.all([
    import(`../messages/${locale}.json`).then((m) => m.default),
    import(`../messages/${locale}.pages.json`)
      .then((m) => m.default)
      .catch(() => ({})),
    import(`../messages/${locale}.content.json`)
      .then((m) => m.default)
      .catch(() => ({})),
  ]);
  return { ...core, ...pages, ...content };
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
