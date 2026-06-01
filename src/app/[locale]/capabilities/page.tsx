import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { Link } from "@/i18n/navigation";
import { CtaBand } from "@/components/ui/CtaBand";
import { CAPABILITY_SLUGS, type Capability } from "@/lib/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "capabilities" });
  return { title: t("seeAll"), description: t("lead") };
}

export default async function CapabilitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("capabilities");
  const tc = await getTranslations();

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ CAPABILITIES" title={t("title")} lead={t("lead")} />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CAPABILITY_SLUGS.map((slug, i) => {
              const cap = tc.raw(`capabilityData.${slug}`) as Capability;
              return (
                <Link
                  key={slug}
                  href={`/capabilities/${slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-sv-md border border-sv-line bg-sv-surface-2 p-6 transition-colors duration-200 hover:border-sv-green-line"
                >
                  <span className="sv-scan-line" aria-hidden />
                  <Bracket />
                  <p className="sv-label-sm sv-label">{`CAPABILITY / 0${i + 1}`}</p>
                  <h2 className="mt-4 font-display text-sv-h3 text-sv-text transition-colors duration-200 group-hover:text-sv-green">
                    {cap.name}
                  </h2>
                  <p className="mt-3 flex-1 text-sv-small text-sv-text-2">{cap.headline}</p>
                  <span className="mt-5 font-mono text-sv-label uppercase tracking-[0.14em] text-sv-text-3 transition-colors group-hover:text-sv-green">
                    {t("cta")} →
                  </span>
                </Link>
              );
            })}

            {/* "Don't see yours?" — keeps the set illustrative, never finite */}
            <div className="relative flex flex-col justify-center rounded-sv-md border border-dashed border-sv-line-strong p-6">
              <p className="sv-label sv-label--live">{t("moreTitle")}</p>
              <p className="mt-3 text-sv-small text-sv-text-2">{t("moreBody")}</p>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand title={t("title")} cta={t("cta")} pageContext="capabilities overview" />
    </>
  );
}
