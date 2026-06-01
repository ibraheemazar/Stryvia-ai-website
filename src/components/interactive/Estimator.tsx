"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChat } from "@/components/chat/ChatProvider";
import { Bracket } from "@/components/ui/Bracket";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Archetype = {
  name: string;
  oldTeam: string;
  oldTime: string;
  oldCost: string;
  newTime: string;
};

// The Speed & Cost estimator (E.2). All numbers are honest ranges from an
// editable config, clearly framed as rough comparisons, never a quote.
export function Estimator() {
  const t = useTranslations("estimator");
  const { open, send } = useChat();
  const archetypes = t.raw("archetypes") as Archetype[];
  const scales = t.raw("scales") as string[];

  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const a = archetypes[idx];

  function scopeIt() {
    track("estimator_used", { archetype: a.name, scale: scales[scale] });
    void send(`I want to build: ${a.name} (${scales[scale]} scale). Help me scope it.`);
    open({ pageContext: `estimator: ${a.name} / ${scales[scale]}` });
  }

  return (
    <div className="relative rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-6 sm:p-8">
      <Bracket live focusIn />

      <p className="sv-label">{t("pickArchetype")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {archetypes.map((arc, i) => (
          <button
            key={arc.name}
            onClick={() => setIdx(i)}
            className={cn(
              "rounded-sv-pill border px-4 py-2 text-sv-small transition-colors duration-200",
              idx === i
                ? "border-sv-green-line bg-sv-green-soft text-sv-green"
                : "border-sv-line text-sv-text-2 hover:border-sv-green-line",
            )}
          >
            {arc.name}
          </button>
        ))}
      </div>

      <p className="sv-label mt-6">{t("pickScale")}</p>
      <div className="mt-4 flex gap-2">
        {scales.map((s, i) => (
          <button
            key={s}
            onClick={() => setScale(i)}
            className={cn(
              "rounded-sv-sm border px-4 py-2 text-sv-small transition-colors duration-200",
              scale === i
                ? "border-sv-green-line text-sv-green"
                : "border-sv-line text-sv-text-2 hover:border-sv-green-line",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* comparison */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sv-md border border-sv-line bg-sv-surface-2/30 p-6 opacity-70">
          <p className="sv-label">{t("oldWay")}</p>
          <dl className="mt-4 space-y-2 text-sv-small">
            <Row k={t("team")} v={a.oldTeam} />
            <Row k={t("time")} v={a.oldTime} />
            <Row k={t("cost")} v={a.oldCost} />
          </dl>
        </div>
        <div className="relative rounded-sv-md border border-sv-green-line bg-sv-surface-2 p-6">
          <Bracket live />
          <p className="sv-label sv-label--live">{t("stryviaWay")}</p>
          <dl className="mt-4 space-y-2 text-sv-small">
            <Row k={t("team")} v="You, directing" green />
            <Row k={t("time")} v={a.newTime} green />
            <Row k={t("cost")} v="a fraction" green />
          </dl>
        </div>
      </div>

      <p className="mt-5 text-sv-small text-sv-text-3">{t("disclaimer")}</p>

      <div className="mt-6">
        <Button variant="primary" onClick={scopeIt}>
          {t("cta")}
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v, green }: { k: string; v: string; green?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-sv-text-3">{k}</dt>
      <dd className={green ? "text-sv-green" : "text-sv-text-2"}>{v}</dd>
    </div>
  );
}
