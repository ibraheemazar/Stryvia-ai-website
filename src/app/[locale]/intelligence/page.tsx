import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Link } from "@/i18n/navigation";
import { IntelligenceExplorer } from "@/components/intelligence/IntelligenceExplorer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "intelligence" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("intelligence");
  const pillars = t.raw("pillars") as { label: string; text: string }[];

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ THE BRAIN" title={t("title")} lead={t("lead")} />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="grid gap-px overflow-hidden rounded-sv-md border border-sv-line bg-sv-line sm:grid-cols-2">
            {pillars.map((p) => (
              <div key={p.label} className="bg-sv-base p-8">
                <p className="sv-label sv-label--live">{p.label}</p>
                <p className="mt-4 text-sv-body text-sv-text-2">{p.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section surface="surface-1" className="py-20 lg:py-28">
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="sv-label sv-label--live">{t("explorerLabel")}</p>
            <h2 className="mt-4 text-sv-h1">{t("explorerTitle")}</h2>
            <p className="mt-4 max-w-2xl text-sv-body text-sv-text-2">{t("explorerBody")}</p>
            <div className="mt-10">
              <IntelligenceExplorer />
            </div>
            <div className="mt-10">
              <Link
                href="/investors"
                className="inline-flex items-center gap-2 font-mono text-sv-small uppercase tracking-[0.14em] text-sv-green"
              >
                {t("investorLink")} →
              </Link>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand title={t("title")} cta={t("cta")} pageContext="the intelligence page" />
    </>
  );
}
