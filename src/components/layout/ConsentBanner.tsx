"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getConsent, setConsent } from "@/lib/consent";

// Cookie / analytics consent notice (privacy policy). Non-essential analytics
// stay off until accepted; declining never affects the site working.
export function ConsentBanner() {
  const t = useTranslations("consent");
  const [show, setShow] = useState(false);

  // Defer the notice so it doesn't compete with the hero Chat / mobile menu at
  // the most important first moment — show after a short delay or first scroll.
  useEffect(() => {
    if (getConsent() !== null) return;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setShow(true);
      window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => {
      if (window.scrollY > 240) reveal();
    };
    const timer = setTimeout(reveal, 4000);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!show) return null;

  function choose(value: "granted" | "denied") {
    setConsent(value);
    setShow(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-sv-md border border-sv-line-strong bg-sv-surface-1/95 p-4 backdrop-blur-md sm:inset-x-auto sm:start-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sv-small text-sv-text-2">
          {t("text")}{" "}
          <Link href="/privacy" className="text-sv-green underline-offset-2 hover:underline">
            {t("privacy")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose("denied")}
            className="rounded-sv-sm border border-sv-line px-3.5 py-1.5 text-sv-small text-sv-text-2 transition-colors hover:text-sv-text"
          >
            {t("decline")}
          </button>
          <button
            onClick={() => choose("granted")}
            className="rounded-sv-sm bg-sv-green px-3.5 py-1.5 text-sv-small font-medium text-sv-on-accent"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
