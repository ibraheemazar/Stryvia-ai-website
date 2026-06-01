import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { CtaBand } from "@/components/ui/CtaBand";
import { Link } from "@/i18n/navigation";
import { isInKingdom } from "@/lib/region";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trust" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function TrustPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("trust");

  // The data-residency claim adapts to the region actually selected (§7).
  const dataBody = isInKingdom() ? t("dataInKingdom") : t("dataNearest");

  const blocks = [
    { label: t("thresholdLabel"), title: t("thresholdTitle"), body: t("thresholdBody"), live: true },
    { label: t("dataLabel"), title: t("dataTitle"), body: dataBody, live: false },
    { label: t("ownershipLabel"), title: t("ownershipTitle"), body: t("ownershipBody"), live: false },
    { label: t("securityLabel"), title: t("securityTitle"), body: t("securityBody"), live: false },
    { label: t("stackLabel"), title: t("stackTitle"), body: t("stackBody"), live: false },
  ];

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ TRUST" title={t("title")} lead={t("lead")} />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="mx-auto max-w-3xl divide-y divide-sv-line">
            {blocks.map((b) => (
              <div key={b.label} className="relative py-10 first:pt-0">
                <p className={`sv-label ${b.live ? "sv-label--live" : ""}`}>{b.label}</p>
                <h2 className="mt-3 font-display text-sv-h2 text-sv-text">{b.title}</h2>
                <p className="mt-4 max-w-2xl text-sv-body text-sv-text-2">{b.body}</p>
              </div>
            ))}

            <div className="relative py-10">
              <div className="relative rounded-sv-md border border-sv-line bg-sv-surface-2/40 p-6">
                <Bracket />
                <p className="text-sv-small text-sv-text-2">{t("rights")}</p>
                <Link
                  href="/privacy"
                  className="mt-4 inline-flex items-center gap-2 font-mono text-sv-small uppercase tracking-[0.14em] text-sv-green"
                >
                  {t("privacyLink")} →
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand title={t("title")} cta={t("cta")} pageContext="trust" />
    </>
  );
}
