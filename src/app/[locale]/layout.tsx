import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing, localeDirection } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { SiteNav } from "@/components/layout/SiteNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ChatDock } from "@/components/chat/ChatDock";
import { ConsentBanner } from "@/components/layout/ConsentBanner";
import "@/styles/globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stryvia.ai";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("title"),
      template: "%s · Stryvia",
    },
    description: t("description"),
    applicationName: "Stryvia",
    alternates: {
      canonical: locale === routing.defaultLocale ? "/" : `/${locale}`,
      languages: {
        en: "/",
        ar: "/ar",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Stryvia",
      title: t("title"),
      description: t("description"),
      locale: locale === "ar" ? "ar_SA" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: "/icon-apple.png",
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = localeDirection[locale] ?? "ltr";

  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <PostHogProvider>
            <ChatProvider>
              {/* Atmosphere layers (A.6) sit behind everything, non-interactive */}
              <div className="sv-vignette" aria-hidden="true" />
              <div className="sv-grain" aria-hidden="true" />

              <SiteNav />
              <main id="main">{children}</main>
              <SiteFooter />
              <ChatDock />
              <ConsentBanner />
            </ChatProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
