import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { SeedTiles, type SeedTile } from "@/components/content/SeedTiles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "galleries" });
  return { title: t("problemsEyebrow"), description: t("problemsLead") };
}

export default async function ProblemGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("galleries");
  const tc = await getTranslations();
  const problems = tc.raw("problemGallery") as string[];

  const tiles: SeedTile[] = problems.map((p, i) => ({
    title: p,
    meta: `PROBLEM / ${String(i + 1).padStart(2, "0")}`,
    seed: p,
    pageContext: "problem gallery",
  }));

  return (
    <>
      <PageHero
        eyebrow={t("problemsEyebrow")}
        code="/ PROBLEMS"
        title={t("problemsTitle")}
        lead={t("problemsLead")}
      />
      <Section className="pt-16 lg:pt-20">
        <Container>
          <SeedTiles tiles={tiles} />
        </Container>
      </Section>
    </>
  );
}
