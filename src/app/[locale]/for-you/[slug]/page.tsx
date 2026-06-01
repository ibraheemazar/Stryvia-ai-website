import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { CtaBand } from "@/components/ui/CtaBand";
import { ScenarioCard } from "@/components/content/ScenarioCard";
import { routing } from "@/i18n/routing";
import { AUDIENCE_SLUGS, type Audience, type Scenario } from "@/lib/content";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    AUDIENCE_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!AUDIENCE_SLUGS.includes(slug as never)) return {};
  const tc = await getTranslations({ locale });
  const a = tc.raw(`audienceData.${slug}`) as Audience;
  return { title: a.name, description: a.headline };
}

export default async function AudiencePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!AUDIENCE_SLUGS.includes(slug as never)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("audiences");
  const tc = await getTranslations();
  const a = tc.raw(`audienceData.${slug}`) as Audience;
  const scenarioLabels = {
    shape: locale === "ar" ? "الحجم" : "SHAPE",
    ownership: locale === "ar" ? "تملك" : "YOU OWN",
  };

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ FOR YOU" title={a.headline} lead={a.lead} />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <p className="sv-label sv-label--live">{t("problemsHeading")}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {a.problems.map((p, i) => (
              <div key={i} className="relative rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-6">
                <p className="sv-label-sm sv-label text-sv-text-3">{`/ 0${i + 1}`}</p>
                <p className="mt-3 text-sv-body text-sv-text">“{p}”</p>
              </div>
            ))}
          </div>

          <div className="relative mt-12 max-w-3xl rounded-sv-md border border-sv-line-strong bg-sv-surface-2/40 p-8">
            <Bracket live />
            <p className="sv-label sv-label--live">{t("changeHeading")}</p>
            <p className="mt-4 text-sv-body-l text-sv-text">{a.change}</p>
          </div>
        </Container>
      </Section>

      <Section surface="surface-1">
        <Container>
          <p className="sv-label">{t("scenariosHeading")}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {a.scenarios.map((sid) => {
              const sc = tc.raw(`scenarios.${sid}`) as Scenario;
              return <ScenarioCard key={sid} scenario={sc} labels={scenarioLabels} />;
            })}
          </div>
        </Container>
      </Section>

      <CtaBand
        title={a.headline}
        cta={t("cta")}
        seed={a.name}
        pageContext={`audience page: ${a.name}`}
      />
    </>
  );
}
