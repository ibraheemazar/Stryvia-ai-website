"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemePicker } from "./ThemePicker";
import { Bracket } from "@/components/ui/Bracket";
import { cn } from "@/lib/utils";

// Top nav (A.8): transparent over the hero, then base with a hairline bottom
// border on scroll. Calm top bar; depth lives in the footer and hubs.
const LINKS = [
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/capabilities", key: "capabilities" },
  { href: "/industries", key: "industries" },
  { href: "/for-you", key: "forYou" },
  { href: "/intelligence", key: "intelligence" },
  { href: "/pricing", key: "pricing" },
] as const;

export function SiteNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <a href="#main" className="sv-skip-link">
        {t("skipToContent")}
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-300 ease-sv",
          scrolled
            ? "border-b border-sv-line bg-sv-base/85 backdrop-blur-md"
            : "border-b border-transparent",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Stryvia home" className="rounded-sv-sm">
            <Logo />
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            <ul className="flex items-center gap-7">
              {LINKS.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "group relative py-1 text-sv-small text-sv-text-2 transition-colors duration-200 hover:text-sv-text",
                        active && "text-sv-text",
                      )}
                    >
                      {t(link.key)}
                      <span
                        className={cn(
                          "absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-sv-green transition-transform duration-200 group-hover:scale-x-100 rtl:origin-right",
                          active && "scale-x-100",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <LanguageSwitcher />
            <ThemePicker />
            <Button href="/start" variant="primary" className="px-4 py-2">
              {t("start")}
            </Button>
          </div>

          {/* mobile */}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center lg:hidden"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="relative block h-4 w-6">
              <span
                className={cn(
                  "absolute inset-x-0 top-0 h-px bg-sv-text transition-all duration-300",
                  open && "top-1.5 rotate-45",
                )}
              />
              <span
                className={cn(
                  "absolute inset-x-0 top-1.5 h-px bg-sv-text transition-opacity duration-200",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute inset-x-0 top-3 h-px bg-sv-text transition-all duration-300",
                  open && "top-1.5 -rotate-45",
                )}
              />
            </span>
          </button>
        </nav>
      </header>

      {/* mobile full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-[45] flex flex-col overflow-y-auto bg-sv-base px-6 pb-8 pt-20 lg:hidden">
          <Bracket inset={16} />
          <ul className="mt-8 flex flex-col gap-2">
            {LINKS.map((link, i) => (
              <li key={link.href} style={{ ["--i" as string]: i }} className="sv-reveal">
                <Link
                  href={link.href}
                  className="block border-b border-sv-line py-4 font-display text-2xl text-sv-text"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-center justify-between">
            <LanguageSwitcher />
            <ThemePicker />
          </div>
          <div className="mt-6">
            <Button href="/start" variant="primary" className="w-full">
              {t("start")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
