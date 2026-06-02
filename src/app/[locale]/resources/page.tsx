import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { Link } from "@/i18n/navigation";
import { ARTICLE_SLUGS, type Article } from "@/lib/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "resources" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("resources");
  const tc = await getTranslations();

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ RESOURCES" title={t("title")} lead={t("lead")} />

      <Section className="pt-16 lg:pt-20">
        <Container>
          <div className="grid gap-4 md:grid-cols-3">
            {ARTICLE_SLUGS.map((slug, i) => {
              const a = tc.raw(`articles.${slug}`) as Article;
              return (
                <Link
                  key={slug}
                  href={`/resources/${slug}`}
                  style={{ ["--i" as string]: i } as React.CSSProperties}
                  className="sv-card sv-rise-strong group relative flex flex-col overflow-hidden rounded-sv-md border border-sv-line bg-sv-surface-2 p-6"
                >
                  <span className="sv-scan-line" aria-hidden />
                  <Bracket />
                  <p className="sv-label-sm sv-label">{`GUIDE / ${String(i + 1).padStart(2, "0")}`}</p>
                  <h2 className="mt-4 font-display text-sv-h3 text-sv-text transition-colors duration-200 group-hover:text-sv-green">
                    {a.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sv-small text-sv-text-2">{a.lead}</p>
                  <span className="mt-5 font-mono text-sv-label uppercase tracking-[0.14em] text-sv-text-3 transition-colors group-hover:text-sv-green">
                    {t("readMore")} →
                  </span>
                </Link>
              );
            })}
          </div>
        </Container>
      </Section>
    </>
  );
}
