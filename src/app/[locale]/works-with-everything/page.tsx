import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { Button } from "@/components/ui/Button";
import { CtaBand } from "@/components/ui/CtaBand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "integrations" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("integrations");
  const points = t.raw("points") as { label: string; text: string }[];
  const nodes = [t("node1"), t("node2"), t("node3"), t("node4")];

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ ORCHESTRATION" title={t("title")} lead={t("lead")} />

      <Section className="pt-12 lg:pt-16">
        <Container>
          {/* Orchestration diagram: Stryvia at the center */}
          <div className="relative mx-auto max-w-2xl rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-10">
            <Bracket live focusIn />
            <div className="flex flex-col items-center gap-8">
              <div className="grid w-full grid-cols-2 gap-4">
                {nodes.map((n) => (
                  <div
                    key={n}
                    className="rounded-sv-md border border-sv-line bg-sv-surface-2 p-4 text-center"
                  >
                    <span className="sv-label-sm sv-label">{n}</span>
                  </div>
                ))}
              </div>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-sv-green-line bg-sv-green-soft">
                <span className="absolute inset-0 animate-ping rounded-full bg-sv-green-soft opacity-40" />
                <span className="sv-label sv-label--live relative">{t("orchestrator")}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-sv-md border border-sv-line bg-sv-line md:grid-cols-3">
            {points.map((p) => (
              <div key={p.label} className="bg-sv-base p-7">
                <p className="sv-label sv-label--live">{p.label}</p>
                <p className="mt-4 text-sv-small text-sv-text-2">{p.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Button href="/intelligence" variant="ghost" arrow>
              {t("cta")}
            </Button>
          </div>
        </Container>
      </Section>

      <CtaBand title={t("title")} cta={t("cta")} pageContext="works with everything" />
    </>
  );
}
