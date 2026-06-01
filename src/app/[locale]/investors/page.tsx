import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { InvestorGate } from "@/components/investors/InvestorGate";
import { CtaBand } from "@/components/ui/CtaBand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "investors" });
  return { title: t("eyebrow"), description: t("gateTitle"), robots: { index: false } };
}

export default async function InvestorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("investors");
  const sections = t.raw("sections") as { label: string; title: string; text: string }[];

  return (
    <Section className="pt-32">
      <Container>
        <InvestorGate>
          {/* The thesis, as a clean memo (D.3) */}
          <div className="mx-auto max-w-3xl">
            <p className="sv-label sv-label--live">{t("eyebrow")}</p>
            <h1 className="mt-6 text-sv-display-l">{t("title")}</h1>

            <div className="mt-14 space-y-12">
              {sections.map((s) => (
                <section key={s.label} className="border-t border-sv-line pt-8">
                  <p className="sv-label sv-label--live">{s.label}</p>
                  <h2 className="mt-3 font-display text-sv-h2 text-sv-text">{s.title}</h2>
                  <p className="mt-3 text-sv-body-l text-sv-text-2">{s.text}</p>
                </section>
              ))}
            </div>
          </div>
        </InvestorGate>
      </Container>
      <div className="mt-12">
        <CtaBand title={t("title")} cta={t("cta")} pageContext="investors" />
      </div>
    </Section>
  );
}
