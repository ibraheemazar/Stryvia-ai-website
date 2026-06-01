import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { CtaBand } from "@/components/ui/CtaBand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "control" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function ControlPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("control");
  const steps = t.raw("steps") as { label: string; text: string }[];

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ DIRECTOR" title={t("title")} lead={t("lead")} />

      <Section className="pt-12 lg:pt-16">
        <Container>
          <div className="grid gap-4 md:grid-cols-2">
            {steps.map((s) => (
              <div
                key={s.label}
                className="relative rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-7"
              >
                <Bracket />
                <p className="sv-label sv-label--live">{s.label}</p>
                <p className="mt-4 text-sv-body text-sv-text-2">{s.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <CtaBand title={t("title")} cta={t("cta")} pageContext="see it in control" />
    </>
  );
}
