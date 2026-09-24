import { getTranslations } from "next-intl/server";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { PageHero } from "@/components/ui/PageHero";
import { IdentityForm } from "./IdentityForm";

// Landing (brief §2.1): one sentence on what this is, what they get, a plain
// confidentiality note, terms + consent, and the light identity form.
export async function LabLanding({ turnstileSiteKey, consentVersion }: { turnstileSiteKey?: string; consentVersion: string }) {
  const t = await getTranslations("lab");
  const facts = ["time", "get", "private"] as const;

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} code={t("code")} title={t("title")} lead={t("lead")} />
      <section className="py-12 lg:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="order-2 lg:order-1">
              <ol className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
                {facts.map((f, i) => (
                  <li key={f} className="sv-reveal border-t border-sv-line pt-4" style={{ ["--i" as string]: i }}>
                    <Eyebrow>{t(`facts.${f}.label`)}</Eyebrow>
                    <p className="mt-3 text-sv-body text-sv-text-2">{t(`facts.${f}.text`)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="order-1 lg:order-2">
              <IdentityForm turnstileSiteKey={turnstileSiteKey} consentVersion={consentVersion} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
