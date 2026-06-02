"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@/components/chat/ChatProvider";
import { Container } from "@/components/ui/primitives";
import { Bracket } from "@/components/ui/Bracket";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/primitives";

type Variant = {
  id: string;
  label: string;
  weight: number;
  eyebrow?: string;
  headline: string;
  subhead?: string;
  body?: string;
  ctaText: string;
};

function pick(variants: Variant[], seed: number): Variant {
  const active = variants.filter((v) => (v.weight ?? 0) > 0);
  const pool = active.length ? active : variants;
  const total = pool.reduce((s, v) => s + (v.weight || 1), 0);
  let point = ((seed % 100000) / 100000) * total;
  for (const v of pool) {
    point -= v.weight || 1;
    if (point <= 0) return v;
  }
  return pool[pool.length - 1];
}

function track(slug: string, variantId: string, kind: "view" | "conversion") {
  try {
    const sent = navigator.sendBeacon?.(
      "/api/exp/track",
      new Blob([JSON.stringify({ slug, variantId, kind })], { type: "application/json" }),
    );
    if (!sent) {
      fetch("/api/exp/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, variantId, kind }),
        keepalive: true,
      });
    }
  } catch {
    /* best-effort */
  }
}

// Renders a published landing page, assigns a sticky A/B variant, records the
// view, and converts via the Chat — closing the loop on the funnel.
export function LandingRenderer({ slug, variants, goal }: { slug: string; variants: Variant[]; goal: string | null }) {
  const { open, send } = useChat();
  const [variant, setVariant] = useState<Variant | null>(null);

  const seed = useMemo(() => {
    if (typeof document === "undefined") return Math.floor(Math.random() * 100000);
    const key = `sv_exp_${slug}`;
    const existing = document.cookie.split("; ").find((c) => c.startsWith(`${key}=`));
    if (existing) return parseInt(existing.split("=")[1], 10) || 0;
    const s = Math.floor(Math.random() * 100000);
    document.cookie = `${key}=${s}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    return s;
  }, [slug]);

  useEffect(() => {
    if (!variants.length) return;
    const v = pick(variants, seed);
    setVariant(v);
    track(slug, v.id, "view");
  }, [variants, seed, slug]);

  if (!variant) return null;

  function convert() {
    if (!variant) return;
    track(slug, variant.id, "conversion");
    void send(goal || variant.headline);
    open({ pageContext: `landing: ${slug}` });
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-24">
      <Container>
        <div className="relative mx-auto max-w-3xl rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-10 lg:p-16">
          <Bracket live focusIn />
          {variant.eyebrow && <Eyebrow live>{variant.eyebrow}</Eyebrow>}
          <h1 className="mt-6 text-sv-display-l leading-[1.0]">{variant.headline}</h1>
          {variant.subhead && (
            <p className="mt-6 max-w-2xl text-sv-body-l text-sv-text-2">{variant.subhead}</p>
          )}
          {variant.body && (
            <div className="mt-6 space-y-3 text-sv-body text-sv-text-2">
              {variant.body.split("\n").filter(Boolean).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
          <div className="mt-10">
            <Button variant="primary" onClick={convert}>
              {variant.ctaText}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
