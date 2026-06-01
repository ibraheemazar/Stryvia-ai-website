import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { CtaBand } from "@/components/ui/CtaBand";
import { ViewTracker } from "@/components/analytics/ViewTracker";
import { routing } from "@/i18n/routing";
import { SCENARIO_SLUGS, type Scenario } from "@/lib/content";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    SCENARIO_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!SCENARIO_SLUGS.includes(slug as never)) return {};
  const tc = await getTranslations({ locale });
  const sc = tc.raw(`scenarios.${slug}`) as Scenario;
  return { title: sc.title, description: sc.problem };
}

export default async function ExampleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!SCENARIO_SLUGS.includes(slug as never)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("galleries");
  const tc = await getTranslations();
  const sc = tc.raw(`scenarios.${slug}`) as Scenario;

  const labels = {
    problem: locale === "ar" ? "الموقف" : "THE SITUATION",
    approach: locale === "ar" ? "المقاربة" : "THE APPROACH",
    shape: locale === "ar" ? "الحجم والمدى" : "THE SHAPE",
    ownership: locale === "ar" ? "ما الذي ستملكه" : "WHAT YOU'D OWN",
  };

  const blocks = [
    { label: labels.problem, text: sc.problem },
    { label: labels.approach, text: sc.approach },
    { label: labels.shape, text: sc.shape },
    { label: labels.ownership, text: sc.ownership, green: true },
  ];

  return (
    <>
      <ViewTracker event="scenario_viewed" properties={{ slug }} />
      <PageHero eyebrow={t("examplesEyebrow")} code="/ EXAMPLE" title={sc.title} />

      <Section className="pt-12 lg:pt-16">
        <Container>
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            {blocks.map((b) => (
              <div
                key={b.label}
                className="relative rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-6"
              >
                <Bracket />
                <p className={`sv-label ${b.green ? "sv-label--live" : ""}`}>{b.label}</p>
                <p className={`mt-3 text-sv-body ${b.green ? "text-sv-green" : "text-sv-text-2"}`}>
                  {b.text}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <CtaBand
        title={sc.title}
        cta={t("examplesCta")}
        seed={sc.title}
        pageContext={`example: ${slug}`}
      />
    </>
  );
}
