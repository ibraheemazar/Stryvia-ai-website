import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Accordion } from "@/components/ui/Accordion";
import { CtaBand } from "@/components/ui/CtaBand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return { title: t("eyebrow"), description: t("title") };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const c = await getTranslations("common");
  const items = t.raw("items") as { q: string; a: string }[];

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ FAQ" title={t("title")} />
      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Accordion items={items} />
          </div>
        </Container>
      </Section>
      <CtaBand title={t("title")} cta={c("startConversation")} pageContext="faq" />
    </>
  );
}
