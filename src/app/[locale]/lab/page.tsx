import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LabLanding } from "@/components/lab/LabLanding";
import { LabUnavailable } from "@/components/lab/LabUnavailable";
import { getLabSettings } from "@/lib/lab/env";
import { LAB_PATH } from "@/config/lab.config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lab.meta" });
  const prefix = locale === "en" ? "" : `/${locale}`;
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: `${prefix}${LAB_PATH}`, languages: { en: LAB_PATH, ar: `/ar${LAB_PATH}` } },
  };
}

export default async function LabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const settings = getLabSettings();
  if (!settings.enabled) return <LabUnavailable />;
  return <LabLanding turnstileSiteKey={settings.turnstile.enabled ? settings.turnstile.siteKey : undefined} consentVersion={settings.consentVersion} />;
}
