import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { SeedTiles, type SeedTile } from "@/components/content/SeedTiles";
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

  const tiles: SeedTile[] = SCENARIO_SLUGS.map((sid, i) => {
    const sc = tc.raw(`scenarios.${sid}`) as Scenario;
    return {
      title: sc.title,
      subtitle: sc.approach,
      meta: `EXAMPLE / ${String(i + 1).padStart(2, "0")}`,
      seed: sc.title,
      pageContext: `example: ${sid}`,
    };
  });

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
          <SeedTiles tiles={tiles} action={t("examplesCta")} />
        </Container>
      </Section>
    </>
  );
}
