import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LabSession } from "@/components/lab/LabSession";
import { LabUnavailable } from "@/components/lab/LabUnavailable";
import { getLabSettings } from "@/lib/lab/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lab.meta" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function LabSessionPage({ params }: { params: Promise<{ locale: string; sessionId: string }> }) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);
  const settings = getLabSettings();
  if (!settings.enabled) return <LabUnavailable />;
  const voiceProvider = settings.stt.provider === "browser" ? "browser" : "server";
  return <LabSession sessionId={sessionId} voiceProvider={voiceProvider} />;
}
