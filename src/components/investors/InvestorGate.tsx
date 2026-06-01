"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Bracket } from "@/components/ui/Bracket";
import { isValidEmail } from "@/lib/utils";

// Short email capture before the thesis (Spec §6.19) — captures intent without
// hiding the page. Once unlocked, the thesis renders.
export function InvestorGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("investors");
  const locale = useLocale();
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError(t("gateError"));
      return;
    }
    setSending(true);
    try {
      await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context: "Investor — thesis access", locale }),
      });
    } catch {
      /* unlock anyway; capture is best-effort */
    }
    setSending(false);
    setUnlocked(true);
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto max-w-xl">
      <div className="relative rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-8 lg:p-10" data-sv-mask>
        <Bracket live focusIn />
        <p className="sv-label sv-label--live">{t("eyebrow")}</p>
        <h1 className="mt-4 font-display text-sv-h1 text-sv-text">{t("gateTitle")}</h1>
        <p className="mt-4 text-sv-body text-sv-text-2">{t("gateBody")}</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("gateEmail")}
            aria-label={t("gateEmail")}
            className="flex-1 rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-sv-body text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
          />
          <Button variant="primary" type="submit" disabled={sending}>
            {t("gateButton")}
          </Button>
        </form>
        {error && <p className="mt-3 text-sv-small text-sv-danger">{error}</p>}
      </div>
    </div>
  );
}
