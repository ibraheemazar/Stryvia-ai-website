import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { CtaBand } from "@/components/ui/CtaBand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "whyExists" });
  return { title: t("eyebrow"), description: t("title") };
}

export default async function WhyExistsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("whyExists");
  const paras = t.raw("paras") as string[];

  return (
    <>
      <Section className="pt-40">
        <Container>
          <p className="sv-label">{t("eyebrow")}</p>
          <div className="mt-12 max-w-3xl space-y-8">
            <h1 className="font-display text-sv-display-l leading-tight">{t("title")}</h1>
            {paras.map((p, i) => (
              <p key={i} className="text-sv-body-l text-sv-text-2">
                {p}
              </p>
            ))}
          </div>
        </Container>
      </Section>
      <CtaBand title={t("title")} cta={t("cta")} pageContext="why stryvia exists" />
    </>
  );
}
