import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { CtaBand } from "@/components/ui/CtaBand";
import { ScenarioCard } from "@/components/content/ScenarioCard";
import { ViewTracker } from "@/components/analytics/ViewTracker";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CAPABILITY_SLUGS, type Capability, type Scenario } from "@/lib/content";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    CAPABILITY_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!CAPABILITY_SLUGS.includes(slug as never)) return {};
  const tc = await getTranslations({ locale });
  const cap = tc.raw(`capabilityData.${slug}`) as Capability;
  return { title: cap.name, description: cap.headline };
}

export default async function CapabilityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!CAPABILITY_SLUGS.includes(slug as never)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("capabilities");
  const tc = await getTranslations();
  const cap = tc.raw(`capabilityData.${slug}`) as Capability;
  const idx = CAPABILITY_SLUGS.indexOf(slug as never);
  const related = Array.from(
    { length: 4 },
    (_, k) => CAPABILITY_SLUGS[(idx + k + 1) % CAPABILITY_SLUGS.length],
  );
  const scenarioLabels = {
    shape: locale === "ar" ? "الحجم" : "SHAPE",
    ownership: locale === "ar" ? "تملك" : "YOU OWN",
  };

  return (
    <>
      <ViewTracker event="capability_viewed" properties={{ slug }} />
      <PageHero
        eyebrow={`${t("eyebrow")} / ${cap.name.toUpperCase()}`}
        code="/ CAPABILITY"
        title={cap.headline}
        lead={cap.lead}
      />

      {/* The problems this solves */}
      <Section className="pt-16 lg:pt-20">
        <Container>
          <p className="sv-label sv-label--live">{t("problemsHeading")}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {cap.problems.map((p, i) => (
              <div key={i} className="relative rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-6">
                <p className="sv-label-sm sv-label text-sv-text-3">{`/ 0${i + 1}`}</p>
                <p className="mt-3 text-sv-body text-sv-text">“{p}”</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Sub-capabilities */}
      <Section surface="surface-1">
        <Container>
          <p className="sv-label">{t("subHeading")}</p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-sv-md border border-sv-line bg-sv-line md:grid-cols-3">
            {cap.sub.map((s) => (
              <div key={s.label} className="relative bg-sv-base p-7">
                <p className="sv-label sv-label--live">{s.label}</p>
                <p className="mt-4 text-sv-small text-sv-text-2">{s.text}</p>
              </div>
            ))}
          </div>

          {/* How the intelligence approaches this */}
          <div className="relative mt-12 max-w-3xl rounded-sv-md border border-sv-line-strong bg-sv-surface-2/40 p-8">
            <Bracket live />
            <p className="sv-label sv-label--live">{t("approachHeading")}</p>
            <p className="mt-4 text-sv-body-l text-sv-text">{cap.approach}</p>
          </div>
        </Container>
      </Section>

      {/* The director relationship — shared across every capability */}
      <Section>
        <Container>
          <p className="sv-label">{t("directorHeading")}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {([
              ["directLabel", "directText"],
              ["liftLabel", "liftText"],
              ["ownLabel", "ownText"],
            ] as const).map(([labelKey, textKey], i) => (
              <div
                key={labelKey}
                style={{ ["--i" as string]: i } as React.CSSProperties}
                className="sv-card sv-rise-strong relative rounded-sv-md border border-sv-line bg-sv-surface-2 p-7"
              >
                <span className="sv-label-sm sv-label text-sv-text-3">{`/ 0${i + 1}`}</span>
                <p className="mt-3 sv-label sv-label--live">{t(labelKey)}</p>
                <p className="mt-3 text-sv-small text-sv-text-2">{t(textKey)}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Scenarios */}
      <Section>
        <Container>
          <p className="sv-label">{t("scenariosHeading")}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {cap.scenarios.map((sid) => {
              const sc = tc.raw(`scenarios.${sid}`) as Scenario;
              return <ScenarioCard key={sid} scenario={sc} labels={scenarioLabels} />;
            })}
          </div>
        </Container>
      </Section>

      {/* Related capabilities — internal linking + a sense of the wider surface */}
      <Section surface="surface-1">
        <Container>
          <p className="sv-label">{t("relatedHeading")}</p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-sv-md border border-sv-line bg-sv-line sm:grid-cols-2 lg:grid-cols-4">
            {related.map((rs) => {
              const rc = tc.raw(`capabilityData.${rs}`) as Capability;
              return (
                <Link
                  key={rs}
                  href={`/capabilities/${rs}`}
                  className="group relative bg-sv-base p-6 transition-colors hover:bg-sv-surface-2"
                >
                  <span className="sv-scan-line" aria-hidden />
                  <p className="font-display text-sv-h3 text-sv-text transition-colors group-hover:text-sv-green">
                    {rc.name}
                  </p>
                  <span className="mt-3 inline-flex font-mono text-sv-label uppercase tracking-[0.14em] text-sv-text-3 transition-colors group-hover:text-sv-green">
                    {t("seeAll")} →
                  </span>
                </Link>
              );
            })}
          </div>
        </Container>
      </Section>

      <CtaBand
        title={cap.headline}
        cta={t("cta")}
        seed={`I'm interested in: ${cap.name}`}
        pageContext={`capability page: ${cap.name}`}
      />
    </>
  );
}
