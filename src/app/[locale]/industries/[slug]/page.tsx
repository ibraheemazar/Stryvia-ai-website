import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { CtaBand } from "@/components/ui/CtaBand";
import { ScenarioCard } from "@/components/content/ScenarioCard";
import { ViewTracker } from "@/components/analytics/ViewTracker";
import { routing } from "@/i18n/routing";
import { INDUSTRY_SLUGS, type Industry, type Scenario } from "@/lib/content";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    INDUSTRY_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!INDUSTRY_SLUGS.includes(slug as never)) return {};
  const tc = await getTranslations({ locale });
  const ind = tc.raw(`industryData.${slug}`) as Industry;
  return { title: ind.name, description: ind.headline };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!INDUSTRY_SLUGS.includes(slug as never)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("industries");
  const tc = await getTranslations();
  const ind = tc.raw(`industryData.${slug}`) as Industry;
  const scenarioLabels = {
    shape: locale === "ar" ? "الحجم" : "SHAPE",
    ownership: locale === "ar" ? "تملك" : "YOU OWN",
  };

  return (
    <>
      <ViewTracker event="industry_viewed" properties={{ slug }} />
      <PageHero
        eyebrow={`${t("eyebrow")} / ${ind.name.toUpperCase()}`}
        code="/ INDUSTRY"
        title={ind.headline}
        lead={ind.lead}
      />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <p className="sv-label sv-label--live">{t("problemsHeading")}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ind.problems.map((p, i) => (
              <div key={i} className="relative rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-6">
                <p className="sv-label-sm sv-label text-sv-text-3">{`/ 0${i + 1}`}</p>
                <p className="mt-3 text-sv-body text-sv-text">“{p}”</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section surface="surface-1">
        <Container>
          <div className="relative max-w-3xl rounded-sv-md border border-sv-line-strong bg-sv-surface-2/40 p-8">
            <Bracket live />
            <p className="sv-label sv-label--live">{t("applyHeading")}</p>
            <p className="mt-4 text-sv-body-l text-sv-text">{ind.apply}</p>
          </div>

          {/* Regional & data note — where it lands for this buyer */}
          <div className="mt-6 max-w-3xl rounded-sv-md border border-sv-line bg-sv-base p-6">
            <p className="sv-label">{t("regionHeading")}</p>
            <p className="mt-3 text-sv-small text-sv-text-2">{ind.note}</p>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <p className="sv-label">{t("scenariosHeading")}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {ind.scenarios.map((sid) => {
              const sc = tc.raw(`scenarios.${sid}`) as Scenario;
              return <ScenarioCard key={sid} scenario={sc} labels={scenarioLabels} />;
            })}
          </div>
        </Container>
      </Section>

      <CtaBand
        title={ind.headline}
        cta={t("cta")}
        seed={`I work in ${ind.name}.`}
        pageContext={`industry page: ${ind.name}`}
      />
    </>
  );
}
