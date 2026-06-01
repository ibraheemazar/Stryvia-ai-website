import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container, Section, Eyebrow } from "@/components/ui/primitives";
import { Bracket } from "@/components/ui/Bracket";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { HeroChat } from "@/components/home/HeroChat";
import { HeroCanvas } from "@/components/home/HeroCanvas";
import { OrchestrationVisual } from "@/components/home/OrchestrationVisual";
import { ChatSeedButton } from "@/components/chat/ChatSeedButton";
import { EarlyAccessForm } from "@/components/forms/EarlyAccessForm";
import {
  IconProduct,
  IconVenture,
  IconCreative,
  IconFinance,
  IconOperations,
  IconInfinity,
  IconBolt,
} from "@/components/ui/Icons";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <>
      {/* ===== Scene 1–2: opening frame + the live Chat ===== */}
      <section className="relative overflow-hidden pt-28 pb-[clamp(64px,10vw,140px)]">
        <div className="sv-field" aria-hidden />
        <HeroCanvas />
        <div className="sv-beam" aria-hidden />
        <Container className="relative z-10">
          <div className="grid items-center gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
            <div className="max-w-2xl">
              <Eyebrow className="sv-reveal" code="/ 01" live>
                {t("scene1.eyebrow")}
              </Eyebrow>
              <h1
                className="sv-grad-green sv-reveal mt-6 text-sv-display-xl leading-[0.98] [text-wrap:balance]"
                style={{ ["--i" as string]: 1 }}
              >
                {t("scene1.headline")}
              </h1>
              <p
                className="sv-reveal mt-6 max-w-xl text-sv-body-l text-sv-text-2"
                style={{ ["--i" as string]: 3 }}
              >
                {t("scene1.subline")}
              </p>
              <div
                className="sv-reveal mt-8 flex flex-wrap gap-2.5"
                style={{ ["--i" as string]: 4 }}
              >
                {(t.raw("scene1.badges") as string[]).map((b) => (
                  <span key={b} className="sv-badge">
                    <span className="h-1.5 w-1.5 rounded-full bg-sv-green" aria-hidden />
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* No reveal transform on this wrapper: a lingering transform would
                become the containing block for the Chat's mobile full-screen
                takeover (fixed inset-0), trapping it. The panel's own bracket
                focus-in carries the entrance. */}
            <div id="hero-chat" className="relative lg:-mt-8">
              <HeroChat />
            </div>
          </div>
        </Container>

        <Container className="relative z-10 mt-16">
          <div className="flex items-center gap-4">
            <span className="sv-label sv-label--live">{t("scene1.scrollCue")}</span>
            <span className="h-px flex-1 bg-sv-line" />
            <span className="sv-label">/ 01 — 10</span>
          </div>
        </Container>
      </section>

      {/* Instrument readout — illustrative breadth, scrolling */}
      <div className="border-y border-sv-line bg-sv-surface-1/50 py-4">
        <div className="sv-marquee">
          <span className="sv-label text-sv-text-3">
            {Array(2)
              .fill(
                "BUILD A PRODUCT · LAUNCH A VENTURE · BRAND & IDENTITY · CAMPAIGNS · MARKETING & GROWTH · OPERATIONS · AUTOMATION · FINANCE & MODELING · STRATEGY · MARKET RESEARCH · DASHBOARDS · CRM · E-COMMERCE · CONTENT AT SCALE · INVESTOR DECKS · WHATEVER YOU BRING · ",
              )
              .join("")}
          </span>
        </div>
      </div>

      {/* ===== Scene 3: the turn ===== */}
      <Section>
        <Container>
          <hr className="sv-rule mb-16 max-w-xs" />
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="sv-grad-text text-sv-display-l">{t("scene3.headline")}</h2>
            <p className="mx-auto mt-8 max-w-2xl text-sv-body-l text-sv-text-2">
              {t("scene3.body")}
            </p>
          </div>
        </Container>
      </Section>

      {/* ===== Scene 4: the wow — orchestration ===== */}
      <Section surface="surface-1">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <Eyebrow live code="/ 04">
                {t("scene4.eyebrow")}
              </Eyebrow>
              <h2 className="mt-6 text-sv-h1">{t("scene4.headline")}</h2>
              <p className="mt-6 max-w-xl text-sv-body text-sv-text-2">
                {t("scene4.body")}
              </p>
              <div className="mt-8">
                <Button href="/intelligence" variant="ghost" arrow>
                  {t("scene4.link")}
                </Button>
              </div>
            </div>
            <div className="relative rounded-sv-lg border border-sv-line bg-sv-surface-2/40 p-8">
              <Bracket />
              <OrchestrationVisual />
              <p className="sv-label sv-label--live mt-6 text-center">
                {t("scene4.nodeOutput")}
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* ===== Scene 5: the expanse ===== */}
      <Section>
        <Container>
          <div className="max-w-2xl">
            <Eyebrow code="/ 05">{t("scene5.eyebrow")}</Eyebrow>
            <h2 className="mt-6 sv-grad-text text-sv-display-l">{t("scene5.headline")}</h2>
            <p className="mt-6 text-sv-body-l text-sv-text-2">{t("scene5.body")}</p>
          </div>
          <ExpanseTiles />
          <div className="mt-10">
            <ChatSeedButton variant="secondary">{t("scene5.action")}</ChatSeedButton>
          </div>
        </Container>
      </Section>

      {/* ===== Scene 6: the gut-punch — speed and cost ===== */}
      <Section surface="surface-1">
        <Container>
          <div className="max-w-2xl">
            <Eyebrow code="/ 06">{t("scene6.eyebrow")}</Eyebrow>
            <h2 className="mt-6 sv-grad-text text-sv-display-l">{t("scene6.headline")}</h2>
            <p className="mt-6 text-sv-body-l text-sv-text-2">{t("scene6.body")}</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-sv-md border border-sv-line bg-sv-surface-2/30 p-7 opacity-70">
              <p className="sv-label">{t("scene6.oldLabel")}</p>
              <p className="mt-6 font-display text-sv-h1 text-sv-text-2">
                {t("scene6.oldTime")}
              </p>
              <ul className="mt-5 space-y-2 text-sv-small text-sv-text-3">
                <li>{t("scene6.oldTeam")}</li>
                <li>{t("scene6.oldCost")}</li>
              </ul>
            </div>
            <div className="relative rounded-sv-md border border-sv-green-line bg-sv-surface-2 p-7">
              <Bracket live />
              <p className="sv-label sv-label--live">{t("scene6.newLabel")}</p>
              <p className="mt-6 font-display text-sv-h1 text-sv-green">
                {t("scene6.newTime")}
              </p>
              <ul className="mt-5 space-y-2 text-sv-small text-sv-text-2">
                <li>{t("scene6.newTeam")}</li>
                <li>{t("scene6.newCost")}</li>
              </ul>
            </div>
          </div>
          <div className="mt-10">
            <ChatSeedButton variant="secondary">{t("scene6.action")}</ChatSeedButton>
          </div>
        </Container>
      </Section>

      {/* ===== Scene 7: the reassurance ===== */}
      <Section>
        <Container>
          <Eyebrow code="/ 07">{t("scene7.eyebrow")}</Eyebrow>
          <div className="mt-10 grid gap-px overflow-hidden rounded-sv-md border border-sv-line bg-sv-line sm:grid-cols-2 lg:grid-cols-4">
            {(["control", "ownership", "data", "limits"] as const).map((k) => (
              <div key={k} className="bg-sv-base p-6">
                <p className="sv-label sv-label--live">{t(`scene7.${k}Label`)}</p>
                <p className="mt-3 text-sv-small text-sv-text-2">{t(`scene7.${k}`)}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ===== Scene 8: the doors ===== */}
      <Section surface="surface-1">
        <Container>
          <Eyebrow code="/ 08">{t("scene8.eyebrow")}</Eyebrow>
          <ul className="mt-8 divide-y divide-sv-line border-y border-sv-line">
            {(t.raw("scene8.doors") as string[]).map((door, i) => (
              <li key={i}>
                <ChatSeedDoor index={i} label={door} />
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ===== Scene 9: the belief ===== */}
      <Section surface="paper">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="sv-label text-sv-ink/50">/ 09</span>
            <blockquote className="mt-8 font-display text-sv-display-l leading-tight text-sv-ink">
              “{t("scene9.quote")}”
            </blockquote>
            <div className="mt-10">
              <Link
                href="/manifesto"
                className="group inline-flex items-center gap-2 font-mono text-sv-small uppercase tracking-[0.14em] text-sv-ink"
              >
                {t("scene9.link")}
                <span className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </Container>
      </Section>

      {/* ===== Scene 10: the return ===== */}
      <Section>
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <span className="sv-label">/ 10</span>
            <h2 className="mt-6 sv-grad-text text-sv-display-l">{t("scene10.headline")}</h2>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/start" variant="primary">
                {t("scene10.start")}
              </Button>
              <Button href="/early-access" variant="secondary">
                {t("scene10.earlyAccess")}
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-16 max-w-xl">
            <EarlyAccessForm compact />
          </div>
        </Container>
      </Section>
    </>
  );
}

// Scene 5 illustrative bento — example entry points, never a finite catalog.
async function ExpanseTiles() {
  const t = await getTranslations("home.scene5");
  const tiles = t.raw("tiles") as { title: string; note: string }[];
  const icons = [
    IconProduct,
    IconVenture,
    IconCreative,
    IconFinance,
    IconOperations,
    IconInfinity,
  ];
  // Bento spans: tile 0 and the final "whatever you bring" tile run wide.
  const span = [
    "lg:col-span-2",
    "",
    "",
    "",
    "",
    "lg:col-span-3",
  ];
  return (
    <div className="mt-12 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile, i) => {
        const Icon = icons[i] ?? IconBolt;
        const last = i === tiles.length - 1;
        return (
          <div
            key={i}
            style={{ ["--i" as string]: i } as React.CSSProperties}
            className={`sv-card sv-rise-strong group relative flex min-h-[180px] flex-col overflow-hidden rounded-sv-lg border p-7 ${span[i] ?? ""} ${
              last
                ? "border-sv-green-line bg-[radial-gradient(120%_140%_at_0%_0%,rgba(192,250,32,0.10),transparent_60%)] bg-sv-surface-2"
                : "border-sv-line bg-sv-surface-2"
            }`}
          >
            <span className="sv-scan-line" aria-hidden />
            <div className="flex items-center justify-between">
              <span className="sv-chip" aria-hidden>
                <Icon size={22} />
              </span>
              <span className="sv-label sv-label-sm">{`/ 0${i + 1}`}</span>
            </div>
            <p className="mt-auto pt-8 font-display text-sv-h3 text-sv-text transition-colors duration-200 group-hover:text-sv-green">
              {tile.title}
            </p>
            <p className="mt-2 text-sv-small text-sv-text-3">{tile.note}</p>
          </div>
        );
      })}
    </div>
  );
}

// A single audience door (scene 8) that seeds the Chat with that framing.
function ChatSeedDoor({ index, label }: { index: number; label: string }) {
  const code = `/ ${String(index + 1).padStart(2, "0")}`;
  return (
    <ChatSeedButton
      seed={label}
      pageContext={`audience door: ${label}`}
      variant="ghost"
      arrow
      className="flex w-full items-center gap-5 py-5 text-start font-display text-sv-h3 font-normal"
    >
      <span className="sv-label text-sv-text-3">{code}</span>
      <span className="text-sv-text">{label}</span>
    </ChatSeedButton>
  );
}
