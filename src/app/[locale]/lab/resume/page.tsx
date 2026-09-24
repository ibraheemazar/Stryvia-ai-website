import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { EmailLinkForm } from "@/components/lab/EmailLinkForm";
import { getLabSettings } from "@/lib/lab/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lab.resume" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ResumePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("lab.resume");
  const settings = getLabSettings();
  return (
    <section className="pt-32 pb-24">
      <Container>
        <div className="mx-auto max-w-xl">
          <Eyebrow code="/ LAB">{t("eyebrow")}</Eyebrow>
          <h1 className="mt-6 font-display text-sv-h1 text-sv-text">{t("title")}</h1>
          <p className="mt-4 text-sv-body-l text-sv-text-2">{t("lead")}</p>
          <div className="mt-10">
            <EmailLinkForm endpoint="/api/lab/resume" ns="lab.resume" turnstileSiteKey={settings.turnstile.enabled ? settings.turnstile.siteKey : undefined} />
          </div>
        </div>
      </Container>
    </section>
  );
}
