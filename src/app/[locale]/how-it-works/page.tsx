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
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");
  const steps = t.raw("steps") as { label: string; title: string; text: string }[];

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ METHOD" title={t("title")} lead={t("lead")} />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="relative mx-auto max-w-3xl">
            {/* connecting rule */}
            <div className="absolute inset-y-0 start-[7px] w-px bg-sv-line" aria-hidden />
            <ol className="space-y-12">
              {steps.map((step, i) => (
                <li
                  key={step.label}
                  className="sv-reveal relative ps-10"
                  style={{ ["--i" as string]: i } as React.CSSProperties}
                >
                  <span className="absolute start-0 top-1.5 h-3.5 w-3.5 rounded-full border border-sv-green-line bg-sv-base">
                    <span className="absolute inset-1 rounded-full bg-sv-green" />
                  </span>
                  <p className="sv-label sv-label--live">{step.label}</p>
                  <h2 className="mt-3 font-display text-sv-h2 text-sv-text">{step.title}</h2>
                  <p className="mt-3 max-w-2xl text-sv-body text-sv-text-2">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      {/* Director control callout */}
      <Section surface="surface-1" className="py-20 lg:py-28">
        <Container>
          <div className="relative mx-auto max-w-3xl rounded-sv-lg border border-sv-line-strong bg-sv-surface-2/40 p-10 lg:p-14">
            <Bracket live />
            <p className="sv-label sv-label--live">{t("directorLabel")}</p>
            <h2 className="mt-4 text-sv-h1">{t("directorTitle")}</h2>
            <p className="mt-5 text-sv-body-l text-sv-text-2">{t("directorBody")}</p>
          </div>
        </Container>
      </Section>

      <CtaBand title={t("directorTitle")} cta={t("cta")} pageContext="how-it-works" />
    </>
  );
}
