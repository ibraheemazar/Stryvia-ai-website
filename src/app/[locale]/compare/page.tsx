import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { Bracket } from "@/components/ui/Bracket";
import { CtaBand } from "@/components/ui/CtaBand";

type Row = { option: string; cost: string; time: string; limit: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compare" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("compare");
  const cols = t.raw("cols") as { option: string; cost: string; time: string; limit: string };
  const rows = t.raw("rows") as Row[];
  const stryvia = t.raw("stryviaRow") as Row;

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code="/ COMPARE" title={t("title")} lead={t("lead")} />

      <Section className="pt-12 lg:pt-16">
        <Container>
          <div className="space-y-3">
            {/* header row (desktop) */}
            <div className="hidden grid-cols-4 gap-4 px-5 md:grid">
              {[cols.option, cols.cost, cols.time, cols.limit].map((c) => (
                <span key={c} className="sv-label">{c}</span>
              ))}
            </div>

            {rows.map((r) => (
              <div
                key={r.option}
                className="grid gap-2 rounded-sv-md border border-sv-line bg-sv-surface-2/30 p-5 md:grid-cols-4 md:gap-4"
              >
                <span className="font-display text-sv-body-l text-sv-text">{r.option}</span>
                <Cell label={cols.cost} value={r.cost} />
                <Cell label={cols.time} value={r.time} />
                <Cell label={cols.limit} value={r.limit} />
              </div>
            ))}

            {/* Stryvia row, highlighted */}
            <div className="relative grid gap-2 rounded-sv-md border border-sv-green-line bg-sv-surface-2 p-5 md:grid-cols-4 md:gap-4">
              <Bracket live />
              <span className="font-display text-sv-body-l text-sv-green">{stryvia.option}</span>
              <Cell label={cols.cost} value={stryvia.cost} green />
              <Cell label={cols.time} value={stryvia.time} green />
              <Cell label={cols.limit} value={stryvia.limit} green />
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand title={t("title")} cta={t("cta")} pageContext="compare" />
    </>
  );
}

function Cell({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <span className="text-sv-small">
      <span className="sv-label-sm sv-label mb-1 block md:hidden">{label}</span>
      <span className={green ? "text-sv-text" : "text-sv-text-2"}>{value}</span>
    </span>
  );
}
