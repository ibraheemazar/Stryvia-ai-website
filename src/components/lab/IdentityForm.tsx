"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { Button } from "@/components/ui/Button";
import { isValidEmail } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { TurnstileWidget } from "./TurnstileWidget";
import { labFetch } from "./lab-client";

// Light identity (brief §2.2): name, email, phone with country code, country;
// company and role optional. Terms must be accepted; consent version is
// stored with the session. Mobile-first, RTL-safe (logical utilities only).

const inputCls =
  "w-full min-h-11 rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3.5 py-2.5 text-sv-body " +
  "text-sv-text placeholder:text-sv-text-3 transition-colors duration-200 " +
  "focus:border-sv-green-line focus:outline-none focus-visible:shadow-[var(--sv-focus-ring)] " +
  "aria-[invalid=true]:border-sv-danger";

const GCC_FIRST: CountryCode[] = ["SA", "AE", "KW", "QA", "BH", "OM", "JO", "LB", "EG", "IQ"];

type Errors = Partial<Record<"name" | "email" | "phone" | "country" | "consent" | "form", string>>;

export function IdentityForm({ turnstileSiteKey, consentVersion }: { turnstileSiteKey?: string; consentVersion: string }) {
  const t = useTranslations("lab.form");
  const tc = useTranslations("lab.consent");
  const locale = useLocale();
  const uiLang: "en" | "ar" = locale === "ar" ? "ar" : "en";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<CountryCode | "">(uiLang === "ar" ? "SA" : "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">(uiLang);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const onToken = useCallback((tok: string | null) => setToken(tok), []);

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    const all = getCountries()
      .map((code) => ({ code, name: names.of(code) ?? code, dial: getCountryCallingCode(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
    const first = GCC_FIRST.map((c) => all.find((x) => x.code === c)).filter(Boolean) as typeof all;
    const rest = all.filter((x) => !GCC_FIRST.includes(x.code));
    return { first, rest };
  }, [locale]);

  const dial = country ? `+${getCountryCallingCode(country)}` : "";

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = t("errors.name");
    if (!isValidEmail(email)) e.email = t("errors.email");
    if (!country) e.country = t("errors.country");
    else {
      const p = parsePhoneNumberFromString(phone, country);
      if (!p || !p.isValid()) e.phone = t("errors.phone");
    }
    if (!consent) e.consent = t("errors.consent");
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    track("lead_started", { source: "idea_lab", language });
    try {
      const { status, data } = await labFetch<{ ok: boolean; url?: string; error?: string }>("/api/lab/start", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          country,
          company: company.trim() || null,
          role: role.trim() || null,
          language,
          consent: true,
          consentVersion,
          turnstileToken: token,
          website,
        }),
      });
      if (data.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      const map: Record<string, string> = {
        invalid_phone: t("errors.phone"),
        invalid_email: t("errors.email"),
        bot_check_failed: t("errors.bot"),
        too_many_sessions: t("errors.tooMany"),
        rate_limited: t("errors.rate"),
      };
      setErrors({ form: map[data.error ?? ""] ?? (status === 503 ? t("errors.generic") : t("errors.generic")) });
    } catch {
      setErrors({ form: t("errors.generic") });
    } finally {
      setSubmitting(false);
    }
  }

  const field = (id: string, label: string, hint?: string, optional?: boolean) => (
    <label htmlFor={id} className="block text-sv-small text-sv-text-2">
      <span className="flex items-baseline gap-2">
        <span className="text-sv-text">{label}</span>
        {optional && <span className="text-sv-label text-sv-text-3">{t("optional")}</span>}
      </span>
      {hint && <span className="mt-0.5 block text-sv-label text-sv-text-3">{hint}</span>}
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="sv-card rounded-sv-lg border border-sv-line bg-sv-surface-2 p-5 sm:p-8" aria-describedby={errors.form ? "lab-form-error" : undefined}>
      <div className="mb-6">
        <h2 className="font-display text-sv-h2 text-sv-text">{t("heading")}</h2>
        <p className="mt-2 text-sv-small text-sv-text-2">{t("sub")}</p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          {field("lab-name", t("name"))}
          <input id="lab-name" name="name" autoComplete="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} required />
          {errors.name && <p className="text-sv-label text-sv-danger">{errors.name}</p>}
        </div>

        <div className="grid gap-1.5">
          {field("lab-email", t("email"), t("emailHint"))}
          <input id="lab-email" name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" className={cn(inputCls, "text-start")} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} required />
          {errors.email && <p className="text-sv-label text-sv-danger">{errors.email}</p>}
        </div>

        <div className="grid gap-1.5">
          {field("lab-country", t("country"))}
          <select id="lab-country" name="country" autoComplete="country" className={inputCls} value={country} onChange={(e) => setCountry(e.target.value as CountryCode)} aria-invalid={Boolean(errors.country)} required>
            <option value="">—</option>
            <optgroup label="GCC & MENA">
              {countries.first.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="—">
              {countries.rest.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </optgroup>
          </select>
          {errors.country && <p className="text-sv-label text-sv-danger">{errors.country}</p>}
        </div>

        <div className="grid gap-1.5">
          {field("lab-phone", t("phone"), t("phoneHint"))}
          <div className="flex gap-2" dir="ltr">
            <span className="inline-flex min-h-11 min-w-16 items-center justify-center rounded-sv-sm border border-sv-line bg-sv-surface-3 px-3 font-mono text-sv-small text-sv-text-2" aria-hidden>
              <bdi>{dial || "+"}</bdi>
            </span>
            <input id="lab-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" className={cn(inputCls, "text-start")} value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(errors.phone)} placeholder="5x xxx xxxx" required />
          </div>
          {errors.phone && <p className="text-sv-label text-sv-danger">{errors.phone}</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            {field("lab-company", t("company"), undefined, true)}
            <input id="lab-company" name="organization" autoComplete="organization" className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            {field("lab-role", t("role"), undefined, true)}
            <input id="lab-role" name="organization-title" autoComplete="organization-title" className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sv-small text-sv-text">{t("language")}</legend>
          <div className="inline-flex w-fit rounded-sv-sm border border-sv-line p-0.5" role="radiogroup">
            {(["ar", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={language === l}
                onClick={() => setLanguage(l)}
                className={cn(
                  "min-h-10 rounded-sv-sm px-4 text-sv-small transition-colors",
                  language === l ? "bg-sv-surface-3 text-sv-text" : "text-sv-text-3 hover:text-sv-text",
                )}
              >
                {l === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Honeypot — invisible to people, tempting to bots. */}
        <div className="absolute -start-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
          <label>
            Website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-4">
          <p className="sv-label mb-3">{tc("title")}</p>
          <ul className="space-y-2 text-sv-small text-sv-text-2">
            {(tc.raw("items") as string[]).map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sv-green" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sv-label text-sv-text-3">{tc("pdpl")}</p>
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sv-small text-sv-text">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-sv-green)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={Boolean(errors.consent)} />
            <span>{tc("label")}</span>
          </label>
          {errors.consent && <p className="mt-1 text-sv-label text-sv-danger">{errors.consent}</p>}
        </div>

        <TurnstileWidget siteKey={turnstileSiteKey} onToken={onToken} language={uiLang} />

        {errors.form && (
          <p id="lab-form-error" role="alert" className="rounded-sv-sm border border-sv-danger/40 bg-sv-danger/10 px-3 py-2 text-sv-small text-sv-text">
            {errors.form}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 pt-1">
          <Button type="submit" variant="primary" disabled={submitting || (Boolean(turnstileSiteKey) && !token)} arrow>
            {submitting ? t("starting") : t("start")}
          </Button>
        </div>
      </div>
    </form>
  );
}
