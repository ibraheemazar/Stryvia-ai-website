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
  const t = await getTranslations({ locale, namespace: "manifesto" });
  return { title: t("eyebrow"), description: t("title") };
}

export default async function ManifestoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("manifesto");
  const paras = t.raw("paras") as string[];

  return (
    <>
      <Section className="pt-40">
        <Container>
          <p className="sv-label">{t("eyebrow")}</p>
          <div className="mt-12 max-w-3xl space-y-8">
            <h1 className="font-display text-sv-display-l leading-tight">
              {paras[0]}
            </h1>
            {paras.slice(1).map((p, i) => (
              <p
                key={i}
                className={
                  i === paras.length - 2
                    ? "border-s-2 border-sv-green ps-6 font-display text-sv-h2 text-sv-text"
                    : "text-sv-body-l text-sv-text-2"
                }
              >
                {p}
              </p>
            ))}
          </div>
        </Container>
      </Section>
      <CtaBand title={t("title")} cta={t("cta")} pageContext="manifesto" />
    </>
  );
}
