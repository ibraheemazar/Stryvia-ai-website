import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Link } from "@/i18n/navigation";
import { CtaBand } from "@/components/ui/CtaBand";
import { AUDIENCE_SLUGS, type Audience } from "@/lib/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "audiences" });
  return { title: t("seeAll"), description: t("lead") };
}

export default async function ForYouPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("audiences");
  const tc = await getTranslations();

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ FOR YOU" title={t("title")} lead={t("lead")} />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <ul className="divide-y divide-sv-line border-y border-sv-line">
            {AUDIENCE_SLUGS.map((slug, i) => {
              const a = tc.raw(`audienceData.${slug}`) as Audience;
              return (
                <li
                  key={slug}
                  className="sv-reveal"
                  style={{ ["--i" as string]: i } as React.CSSProperties}
                >
                  <Link
                    href={`/for-you/${slug}`}
                    className="group flex items-center gap-5 py-5 transition-colors duration-200"
                  >
                    <span className="sv-label text-sv-text-3">{`/ ${String(i + 1).padStart(2, "0")}`}</span>
                    <span className="flex-1 font-display text-sv-h3 text-sv-text transition-colors duration-200 group-hover:text-sv-green">
                      {a.name}
                    </span>
                    <span className="font-mono text-sv-text-3 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <CtaBand title={t("title")} cta={t("overviewCta")} pageContext="for-you overview" />
    </>
  );
}
