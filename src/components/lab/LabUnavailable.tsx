import { getTranslations } from "next-intl/server";
import { Container, Eyebrow } from "@/components/ui/primitives";

// Shown when the Lab is switched off or misconfigured — never a 500.
export async function LabUnavailable() {
  const t = await getTranslations("lab");
  return (
    <section className="pt-32 pb-24">
      <Container>
        <div className="mx-auto max-w-2xl">
          <Eyebrow code={t("code")}>{t("eyebrow")}</Eyebrow>
          <h1 className="mt-6 font-display text-sv-h1 text-sv-text">{t("unavailable.title")}</h1>
          <p className="mt-4 text-sv-body-l text-sv-text-2">{t("unavailable.body")}</p>
        </div>
      </Container>
    </section>
  );
}
