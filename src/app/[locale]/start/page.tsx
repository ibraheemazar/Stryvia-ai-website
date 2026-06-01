import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/primitives";
import { Eyebrow } from "@/components/ui/primitives";
import { StartChat } from "@/components/chat/StartChat";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "start" });
  return { title: t("eyebrow"), description: t("lead") };
}

export default async function StartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("start");

  return (
    <section className="pt-32 pb-24">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Eyebrow code="/ START">{t("eyebrow")}</Eyebrow>
          <h1 className="mt-6 text-sv-display-l">{t("title")}</h1>
          <p className="mt-6 max-w-2xl text-sv-body-l text-sv-text-2">{t("lead")}</p>
          <div className="mt-12">
            <StartChat />
          </div>
        </div>
      </Container>
    </section>
  );
}
