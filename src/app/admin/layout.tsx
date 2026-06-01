import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "@/styles/globals.css";

// The admin is a separate root layout (its own html/body), locale-agnostic,
// noindex. The site's localized layout does not apply here.
export const metadata: Metadata = {
  title: "Stryvia Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={fontVariables} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
