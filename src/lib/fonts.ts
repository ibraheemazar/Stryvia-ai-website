import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  JetBrains_Mono,
  IBM_Plex_Sans_Arabic,
} from "next/font/google";

// Open-source set, locked (Decisions §1.3). next/font self-hosts these at
// build time — no external font requests at runtime. Display and body are
// the priority families; mono and Arabic load next.

export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: true,
});

export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600"],
  preload: true,
});

export const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-plex-arabic",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const fontVariables = [
  bricolage.variable,
  hanken.variable,
  jetbrains.variable,
  plexArabic.variable,
].join(" ");
