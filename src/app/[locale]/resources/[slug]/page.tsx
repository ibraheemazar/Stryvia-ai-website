import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { CtaBand } from "@/components/ui/CtaBand";
import { routing } from "@/i18n/routing";
import { ARTICLE_SLUGS, type Article } from "@/lib/content";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    ARTICLE_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!ARTICLE_SLUGS.includes(slug as never)) return {};
  const tc = await getTranslations({ locale });
  const a = tc.raw(`articles.${slug}`) as Article;
  return { title: a.title, description: a.lead };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!ARTICLE_SLUGS.includes(slug as never)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("resources");
  const c = await getTranslations("common");
  const tc = await getTranslations();
  const a = tc.raw(`articles.${slug}`) as Article;

  return (
    <>
      <Section className="pt-40">
        <Container>
          <article className="mx-auto max-w-2xl">
            <p className="sv-label">{t("eyebrow")}</p>
            <h1 className="mt-6 font-display text-sv-display-l leading-tight">{a.title}</h1>
            <p className="mt-6 text-sv-body-l text-sv-text-2">{a.lead}</p>
            <div className="mt-10 space-y-6">
              {a.body.map((p, i) => (
                <p key={i} className="text-sv-body text-sv-text-2">
                  {p}
                </p>
              ))}
            </div>
          </article>
        </Container>
      </Section>
      <CtaBand title={a.title} cta={c("startConversation")} seed={a.title} pageContext={`resource: ${slug}`} />
    </>
  );
}
