"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Bracket } from "@/components/ui/Bracket";
import { track } from "@/lib/analytics";
import { isValidEmail } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Secondary capture (Spec §6.20). Honest, forward, never confesses
// incompleteness; frames access as something granted.
export function EarlyAccessForm({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("earlyAccess");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [context, setContext] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError(t("errorRequired"));
    if (!isValidEmail(email)) return setError(t("errorEmail"));
    setState("sending");
    track("early_access_submitted", { locale });
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, context, locale }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setState("done");
    } catch {
      setState("idle");
      setError(t("errorRequired"));
    }
  }

  const inputCls =
    "w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-sv-body " +
    "text-sv-text placeholder:text-sv-text-3 transition-colors duration-200 focus:border-sv-green-line focus:outline-none";

  if (state === "done") {
    return (
      <div className="relative rounded-sv-md border border-sv-green-line bg-sv-green-soft/30 p-6 text-center">
        <Bracket live />
        <p className="sv-label sv-label--live">✓ {t("eyebrow")}</p>
        <p className="mt-3 text-sv-body text-sv-text">{t("success")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-sv-mask
      className={cn(
        "relative rounded-sv-md border border-sv-line-strong bg-sv-surface-1 p-6",
        !compact && "sm:p-8",
      )}
    >
      <Bracket />
      <p className="sv-label">{t("eyebrow")}</p>
      <h3 className="mt-3 font-display text-sv-h2 text-sv-text">{t("title")}</h3>
      <p className="mt-2 text-sv-small text-sv-text-2">{t("body")}</p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <input
          className={inputCls}
          placeholder={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          aria-label={t("name")}
        />
        <input
          className={inputCls}
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          aria-label={t("email")}
        />
      </div>
      {!compact && (
        <textarea
          className={cn(inputCls, "mt-2.5 min-h-20 resize-none")}
          placeholder={t("context")}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          aria-label={t("context")}
        />
      )}

      {error && <p className="mt-3 text-sv-small text-sv-danger">{error}</p>}

      <div className="mt-5">
        <Button variant="primary" type="submit" disabled={state === "sending"}>
          {state === "sending" ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
