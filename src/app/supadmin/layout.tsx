import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import {
  ACCENTS,
  ACCENT_COOKIE,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  MODE_COOKIE,
} from "@/lib/theme";
import "@/styles/globals.css";

// The admin is a separate root layout (its own html/body), locale-agnostic,
// noindex. The site's localized layout does not apply here — but the theme
// system does: the admin shares the same light/dark + accent palette as the
// public site, keyed by [data-theme]/[data-accent] on <html> and persisted in
// the same cookies, so a colour chosen in either place applies to both.
export const metadata: Metadata = {
  title: "Stryvia Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const accentIds = ACCENTS.map((a) => a.id);
  // Apply the saved theme (or OS preference on first visit) before paint, the
  // same pre-paint script the main site uses, so there's no colour flash.
  const themeScript =
    `(function(){try{var d=document.documentElement,c=document.cookie;` +
    `var m=(c.match(/(?:^|; )${MODE_COOKIE}=([^;]+)/)||[])[1];` +
    `var a=(c.match(/(?:^|; )${ACCENT_COOKIE}=([^;]+)/)||[])[1];` +
    `if(!m){m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'${DEFAULT_MODE}';}` +
    `d.dataset.theme=m==='light'?'light':'dark';` +
    `var A=${JSON.stringify(accentIds)};` +
    `d.dataset.accent=A.indexOf(a)>-1?a:'${DEFAULT_ACCENT}';` +
    `}catch(e){}})();`;

  return (
    <html
      lang="en"
      dir="ltr"
      data-theme={DEFAULT_MODE}
      data-accent={DEFAULT_ACCENT}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
