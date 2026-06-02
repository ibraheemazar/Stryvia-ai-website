import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { Link } from "@/i18n/navigation";
import { SCENARIO_SLUGS, type Scenario } from "@/lib/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "galleries" });
  return { title: t("examplesEyebrow"), description: t("examplesLead") };
}

export default async function ExamplesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("galleries");
  const tc = await getTranslations();

  return (
    <>
      <PageHero
        eyebrow={t("examplesEyebrow")}
        code="/ EXAMPLES"
        title={t("examplesTitle")}
        lead={t("examplesLead")}
      />
      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCENARIO_SLUGS.map((sid, i) => {
              const sc = tc.raw(`scenarios.${sid}`) as Scenario;
              return (
                <Link
                  key={sid}
                  href={`/examples/${sid}`}
                  style={{ ["--i" as string]: i } as React.CSSProperties}
                  className="sv-card sv-rise-strong group relative flex h-full flex-col overflow-hidden rounded-sv-md border border-sv-line bg-sv-surface-2 p-6"
                >
                  <span className="sv-scan-line" aria-hidden />
                  <Bracket />
                  <p className="sv-label-sm sv-label">{`EXAMPLE / ${String(i + 1).padStart(2, "0")}`}</p>
                  <p className="mt-3 flex-1 font-display text-sv-h3 text-sv-text transition-colors duration-200 group-hover:text-sv-green">
                    {sc.title}
                  </p>
                  <span className="mt-5 font-mono text-sv-label uppercase tracking-[0.14em] text-sv-text-3 transition-colors group-hover:text-sv-green">
                    {t("examplesCta")} →
                  </span>
                </Link>
              );
            })}
          </div>
        </Container>
      </Section>
    </>
  );
}
