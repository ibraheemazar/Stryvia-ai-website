import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StryviaMark } from "@/components/brand/Logo";
import { Container } from "@/components/ui/primitives";

// Footer (D.1b): wordmark, a compact three-column sitemap, the Start and Early
// access actions, a mono coordinate line, copyright. The richer sections of the
// site are reached from here so the top bar stays calm.
export function SiteFooter() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const sf = useTranslations("solutionFinder");
  const est = useTranslations("estimator");
  const year = new Date().getFullYear();

  const cols = [
    {
      heading: t("explore"),
      links: [
        { href: "/how-it-works", label: nav("howItWorks") },
        { href: "/capabilities", label: nav("capabilities") },
        { href: "/industries", label: nav("industries") },
        { href: "/for-you", label: nav("forYou") },
        { href: "/intelligence", label: nav("intelligence") },
        { href: "/works-with-everything", label: nav("worksWith") },
        { href: "/compare", label: nav("compare") },
        { href: "/see-it-in-control", label: nav("control") },
        { href: "/pricing", label: nav("pricing") },
      ],
    },
    {
      heading: t("company"),
      links: [
        { href: "/manifesto", label: nav("manifesto") },
        { href: "/why-stryvia-exists", label: nav("whyExists") },
        { href: "/solution-finder", label: sf("eyebrow") },
        { href: "/estimate", label: est("eyebrow") },
        { href: "/resources", label: nav("resources") },
        { href: "/faq", label: nav("faq") },
        { href: "/investors", label: t("investors") },
      ],
    },
    {
      heading: t("trustCol"),
      links: [
        { href: "/examples", label: nav("examples") },
        { href: "/problems", label: nav("problems") },
        { href: "/outcomes", label: nav("outcomes") },
        { href: "/trust", label: nav("trust") },
        { href: "/start", label: t("start") },
        { href: "/early-access", label: t("earlyAccess") },
        { href: "/privacy", label: t("privacy") },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-sv-line bg-sv-surface-1">
      <Container className="py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Stryvia home">
              <StryviaMark size={30} />
              <span className="font-display text-lg tracking-[0.22em] text-sv-text">
                STRYVIA
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sv-small text-sv-text-2">{t("tagline")}</p>
          </div>

          {cols.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="sv-label mb-4">{col.heading}</p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sv-small text-sv-text-2 transition-colors duration-200 hover:text-sv-green"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-sv-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="sv-label text-sv-text-3">{t("coordinate")}</p>
          <p className="text-sv-label-sm text-sv-text-3">
            © {year} Stryvia. {t("rights")}
          </p>
        </div>
      </Container>
    </footer>
  );
}
