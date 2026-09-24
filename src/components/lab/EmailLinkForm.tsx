"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { isValidEmail } from "@/lib/utils";
import { TurnstileWidget } from "./TurnstileWidget";
import { labFetch } from "./lab-client";

// Shared by "resume" and "delete my data": email → link. Always shows the same
// success message so nobody can learn whether an email exists.
export function EmailLinkForm({ endpoint, ns, turnstileSiteKey }: { endpoint: string; ns: "lab.resume" | "lab.privacy"; turnstileSiteKey?: string }) {
  const t = useTranslations(ns);
  const te = useTranslations("lab.form.errors");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const onToken = useCallback((tok: string | null) => setToken(tok), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) return setState("error");
    setState("sending");
    const { data } = await labFetch<{ ok: boolean }>(endpoint, {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), language: locale === "ar" ? "ar" : "en", turnstileToken: token, website: "" }),
    });
    setState(data.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return <p className="rounded-sv-md border border-sv-green-line bg-sv-green-soft/40 p-5 text-sv-body text-sv-text" role="status">{t("sent")}</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <label className="grid gap-1.5 text-sv-small text-sv-text">
        {t("email")}
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          className="min-h-11 w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-start text-sv-body text-sv-text placeholder:text-sv-text-3 focus:border-sv-green-line focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <TurnstileWidget siteKey={turnstileSiteKey} onToken={onToken} language={locale === "ar" ? "ar" : "en"} />
      {state === "error" && <p role="alert" className="text-sv-small text-sv-danger">{te("email")}</p>}
      <div>
        <Button type="submit" variant="primary" disabled={state === "sending" || (Boolean(turnstileSiteKey) && !token)} arrow>
          {state === "sending" ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}
