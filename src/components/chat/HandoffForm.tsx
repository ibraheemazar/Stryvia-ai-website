"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useChat } from "./ChatProvider";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { isValidEmail } from "@/lib/utils";

// The handoff (A.8): an inline capture with the conversation visibly attached.
// On submit, the full transcript and contact details post to /api/lead.
export function HandoffForm() {
  const t = useTranslations("chat.handoff");
  const locale = useLocale();
  const { messages, conversationId, pageContext, markConverted, converted } = useChat();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError(t("errorRequired"));
      return;
    }
    if (!isValidEmail(email)) {
      setError(t("errorEmail"));
      return;
    }
    setSubmitting(true);
    track("lead_submitted", { locale });
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? "",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          messages,
          locale,
          pageContext,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error("lead failed");
      markConverted();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (converted) {
    return (
      <div className="rounded-sv-md border border-sv-green-line bg-sv-green-soft/40 p-5">
        <p className="sv-label sv-label--live mb-2">✓ {t("successTitle")}</p>
        <p className="text-sv-small text-sv-text-2">{t("successBody")}</p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-sv-body " +
    "text-sv-text placeholder:text-sv-text-3 transition-colors duration-200 " +
    "focus:border-sv-green-line focus:outline-none";

  return (
    <form
      onSubmit={onSubmit}
      onFocus={() => track("lead_started", { locale })}
      className="rounded-sv-md border border-sv-line-strong bg-sv-surface-2 p-5"
      data-sv-mask
    >
      <p className="sv-label sv-label--live mb-1">{t("title")}</p>
      <p className="mb-4 text-sv-small text-sv-text-3">{t("carry")}</p>

      <div className="space-y-2.5">
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
        <input
          className={inputCls}
          placeholder={t("company")}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          autoComplete="organization"
          aria-label={t("company")}
        />
        <input
          className={inputCls}
          placeholder={t("phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          autoComplete="tel"
          aria-label={t("phone")}
        />
      </div>

      {error && <p className="mt-3 text-sv-small text-sv-danger">{error}</p>}

      <div className="mt-4">
        <Button variant="primary" type="submit" disabled={submitting} className="w-full">
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
