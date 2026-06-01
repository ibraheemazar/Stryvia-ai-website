"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, localeNames } from "@/i18n/routing";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// Persistent language switcher (Decisions §3). Switches the active locale
// while preserving the current path; the layout handles direction + font.
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className={cn("flex items-center gap-1", className)} role="group">
      {routing.locales.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            disabled={active || isPending}
            onClick={() => {
              track("language_switched", { from: locale, to: loc });
              startTransition(() => {
                router.replace(pathname, { locale: loc });
              });
            }}
            className={cn(
              "sv-label-sm sv-label rounded-sv-sm px-2 py-1 transition-colors duration-200",
              active
                ? "text-sv-green"
                : "text-sv-text-3 hover:text-sv-text",
            )}
            aria-current={active ? "true" : undefined}
            lang={loc}
          >
            {loc === "ar" ? localeNames.ar : loc.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
