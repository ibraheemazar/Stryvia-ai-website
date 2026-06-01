import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getPublishedPage } from "@/lib/marketing/landing";
import { LandingRenderer } from "@/components/marketing/LandingRenderer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  return {
    title: page?.name ?? "Stryvia",
    robots: { index: false }, // campaign pages aren't indexed by default
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = await getPublishedPage(slug);
  if (!page || page.variants.length === 0) notFound();
  return <LandingRenderer slug={page.slug} variants={page.variants} goal={page.goal} />;
}
