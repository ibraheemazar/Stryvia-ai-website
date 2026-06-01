import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { isInKingdom } from "@/lib/region";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title"), description: t("draftNote") };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  const sections = t.raw("sections") as { h: string; p: string }[];
  const residency = isInKingdom() ? t("regionInKingdom") : t("regionNearest");

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ PDPL" title={t("title")} />
      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="mx-auto max-w-2xl">
            <p className="sv-label mb-6">
              {t("lastUpdated")}: 2026-06-01
            </p>
            <div className="rounded-sv-md border border-sv-warn/30 bg-sv-surface-2/40 p-5">
              <p className="text-sv-small text-sv-text-2">{t("draftNote")}</p>
            </div>

            <div className="mt-12 space-y-10">
              {sections.map((s) => (
                <section key={s.h}>
                  <h2 className="font-display text-sv-h3 text-sv-text">{s.h}</h2>
                  <p className="mt-3 text-sv-body text-sv-text-2">{s.p}</p>
                  {/* Append the honest residency line to the storage section. */}
                  {s.h.toLowerCase().includes("stored") ||
                  s.h.includes("تُخزَّن") ? (
                    <p className="mt-3 text-sv-body text-sv-text">{residency}</p>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
