import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { SolutionFinder } from "@/components/interactive/SolutionFinder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "solutionFinder" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function SolutionFinderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("solutionFinder");

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ FINDER" title={t("title")} lead={t("lead")} />
      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SolutionFinder />
          </div>
        </Container>
      </Section>
    </>
  );
}
