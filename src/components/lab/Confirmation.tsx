"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/primitives";
import { LAB_PATH } from "@/config/lab.config";

// Confirmation (brief §2.7): the brief went to manual review — nothing more.
// No promise is made unless the owner configured a response commitment, and
// submission is explicitly not a decision.
export function Confirmation({ sessionId, responseDays, submittedVersion }: { sessionId: string; responseDays: number | null; submittedVersion: number | null }) {
  const t = useTranslations("lab.confirmation");
  return (
    <div className="mx-auto max-w-2xl py-8 text-center sm:py-16" data-testid="confirmation">
      <Eyebrow live>{t("eyebrow")}</Eyebrow>
      <h2 className="mt-6 font-display text-sv-h1 text-sv-text">{t("title")}</h2>
      <p className="mt-4 text-sv-body-l text-sv-text-2">{t("body")}</p>
      {responseDays != null && <p className="mt-3 text-sv-body text-sv-text-2">{t("responseDays", { days: responseDays })}</p>}
      <p className="mt-3 text-sv-small text-sv-text-3">
        {t("emailed")}
        {submittedVersion != null && <> · {t("version", { n: submittedVersion })}</>}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href={`${LAB_PATH}/s/${sessionId}/brief`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-2 rounded-sv-sm border border-sv-line-strong px-5 text-sv-body text-sv-text transition-colors hover:border-sv-green-line hover:text-sv-green"
        >
          {t("print")}
        </a>
        <Button href="/" variant="ghost" arrow>
          {t("home")}
        </Button>
      </div>
    </div>
  );
}
