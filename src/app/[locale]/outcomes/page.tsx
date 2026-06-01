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
  const t = await getTranslations({ locale, namespace: "galleries" });
  return { title: t("outcomesEyebrow"), description: t("outcomesLead") };
}

export default async function OutcomesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("galleries");
  const tc = await getTranslations();
  const outcomes = tc.raw("outcomes") as { label: string; text: string }[];

  return (
    <>
      <PageHero
        eyebrow={t("outcomesEyebrow")}
        code="/ OUTCOMES"
        title={t("outcomesTitle")}
        lead={t("outcomesLead")}
      />
      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="grid gap-px overflow-hidden rounded-sv-md border border-sv-line bg-sv-line sm:grid-cols-2 lg:grid-cols-3">
            {outcomes.map((o) => (
              <div key={o.label} className="bg-sv-base p-8">
                <p className="sv-label sv-label--live">{o.label}</p>
                <p className="mt-4 text-sv-body text-sv-text-2">{o.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
      <CtaBand title={t("outcomesTitle")} cta={t("outcomesCta")} pageContext="outcomes" />
    </>
  );
}
