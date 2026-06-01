import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const points = t.raw("points") as { label: string; text: string }[];

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ PRICING" title={t("title")} lead={t("lead")} />
      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="grid gap-px overflow-hidden rounded-sv-md border border-sv-line bg-sv-line sm:grid-cols-2">
            {points.map((p) => (
              <div key={p.label} className="bg-sv-base p-8">
                <p className="sv-label sv-label--live">{p.label}</p>
                <p className="mt-4 text-sv-body text-sv-text-2">{p.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
      <CtaBand title={t("title")} cta={t("cta")} pageContext="pricing" />
    </>
  );
}
