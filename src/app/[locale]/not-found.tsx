import { useTranslations } from "next-intl";
import { Container, Section } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <Section className="pt-40">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="sv-label sv-label--live">{t("code")}</p>
          <h1 className="mt-6 text-sv-display-l">{t("title")}</h1>
          <p className="mt-6 text-sv-body-l text-sv-text-2">{t("body")}</p>
          <div className="mt-10 flex justify-center">
            <Button href="/" variant="primary">
              {t("cta")}
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
