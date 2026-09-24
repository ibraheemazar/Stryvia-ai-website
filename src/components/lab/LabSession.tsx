"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Container } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { LAB_CONVERSATION, LAB_PATH } from "@/config/lab.config";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { BriefReview } from "./BriefReview";
import { Composer } from "./Composer";
import { Confirmation } from "./Confirmation";
import { MessageBubble } from "./MessageBubble";
import { ProgressRail } from "./ProgressRail";
import { labFetch, newClientTurnId, readTurnStream, type BriefView, type MessageView, type SessionView, type TurnMeta } from "./lab-client";

// The session screen (brief §2.3–§2.7): interview → brief review →
// confirmation, driven by server state. Every turn is persisted server-side;
// a failed AI call leaves the visitor message in place with a Retry.

type Load = { state: "loading" } | { state: "denied" } | { state: "unavailable" } | { state: "ready" };

export function LabSession({ sessionId, voiceProvider }: { sessionId: string; voiceProvider: "browser" | "server" }) {
  const t = useTranslations("lab.session");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [session, setSession] = useState<SessionView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [options, setOptions] = useState<string[] | undefined>();
  const [banner, setBanner] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const lastTurnId = useRef<string>(newClientTurnId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  const hydrate = useCallback(async () => {
    const { status, data } = await labFetch<{ ok: boolean; session: SessionView; messages: MessageView[]; brief: BriefView | null; error?: string }>(
      `/api/lab/session/${sessionId}`,
    );
    if (status === 401 || status === 404) return setLoad({ state: "denied" });
    if (status === 503) return setLoad({ state: "unavailable" });
    if (!data.ok) return setLoad({ state: "unavailable" });
    setSession(data.session);
    setMessages(data.messages);
    setBrief(data.brief);
    if (data.session.status !== "in_progress") setSubmitted(data.session.responseDays);
    setLoad({ state: "ready" });
  }, [sessionId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const applyMeta = useCallback((meta: TurnMeta) => {
    setSession((s) => (s ? { ...s, phase: meta.phase, progress: meta.progress, status: meta.status } : s));
    setOptions(meta.options);
    setBanner(meta.budgetWarning ? t("budgetWarning") : null);
  }, [t]);

  const runStream = useCallback(
    async (url: string, body: Record<string, unknown>, assistantIndex: number) => {
      setStreaming(true);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "same-origin",
        });
        const meta = await readTurnStream(res, (text) => {
          setMessages((ms) => ms.map((m, i) => (i === assistantIndex ? { ...m, content: text } : m)));
        });
        setMessages((ms) => ms.map((m, i) => (i === assistantIndex ? { ...m, pending: false, failed: Boolean(meta.error) } : m)));
        applyMeta(meta);
        if (meta.ended) setSubmitted(null);
        if (meta.phase === "review" && !meta.error) await finish();
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 409 && (err as { code?: string }).code === "busy") {
          setBanner(t("busy"));
          setMessages((ms) => ms.filter((_, i) => i !== assistantIndex));
        } else {
          setMessages((ms) => ms.map((m, i) => (i === assistantIndex ? { ...m, pending: false, failed: true } : m)));
        }
      } finally {
        setStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyMeta, t],
  );

  async function send(text: string, mode: "text" | "voice", raw?: string) {
    if (!session || streaming) return;
    if (!openedRef.current) {
      openedRef.current = true;
      track("chat_first_message", { source: "idea_lab" });
    }
    lastTurnId.current = newClientTurnId();
    setOptions(undefined);
    const user: MessageView = { id: `u_${lastTurnId.current}`, role: "user", content: text, inputMode: mode };
    const assistant: MessageView = { id: `a_${lastTurnId.current}`, role: "assistant", content: "", inputMode: "text", pending: true };
    let assistantIndex = 0;
    setMessages((ms) => {
      assistantIndex = ms.length + 1;
      return [...ms, user, assistant];
    });
    await runStream(`/api/lab/session/${sessionId}/turn`, { content: text, inputMode: mode, transcriptRaw: raw ?? null, clientTurnId: lastTurnId.current }, assistantIndex);
  }

  async function retry() {
    if (!session || streaming) return;
    let assistantIndex = -1;
    setMessages((ms) => {
      const idx = ms.findIndex((m) => m.failed);
      if (idx === -1) return ms;
      assistantIndex = idx;
      return ms.map((m, i) => (i === idx ? { ...m, content: "", failed: false, pending: true } : m));
    });
    if (assistantIndex === -1) return;
    lastTurnId.current = newClientTurnId();
    await runStream(`/api/lab/session/${sessionId}/retry`, { clientTurnId: lastTurnId.current }, assistantIndex);
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      const { data } = await labFetch<{ ok: boolean; brief?: BriefView; error?: string }>(`/api/lab/session/${sessionId}/finish`, { method: "POST" });
      if (data.ok && data.brief) {
        setBrief(data.brief);
        setSession((s) => (s ? { ...s, phase: "review", progress: 0.95 } : s));
        track("chat_scope_returned", { source: "idea_lab" });
      } else {
        setBanner(t("errorTurn"));
      }
    } finally {
      setFinishing(false);
    }
  }

  async function switchLanguage(lang: "en" | "ar") {
    if (!session) return;
    await labFetch(`/api/lab/session/${sessionId}/language`, { method: "POST", body: JSON.stringify({ language: lang }) });
    setSession({ ...session, language: lang });
    track("language_switched", { source: "idea_lab", to: lang });
    router.replace(pathname, { locale: lang });
  }

  // ---- render --------------------------------------------------------------

  if (load.state === "loading") {
    return (
      <Container className="pt-32 pb-24">
        <p className="sv-label sv-label--live">{t("loading")}</p>
      </Container>
    );
  }
  if (load.state === "denied") {
    return (
      <Container className="pt-32 pb-24">
        <div className="mx-auto max-w-xl">
          <h1 className="font-display text-sv-h1 text-sv-text">{t("notYours")}</h1>
          <p className="mt-4 text-sv-body-l text-sv-text-2">{t("notYoursBody")}</p>
          <div className="mt-8">
            <Button href={`${LAB_PATH}/resume`} variant="primary" arrow>{t("requestLink")}</Button>
          </div>
        </div>
      </Container>
    );
  }
  if (load.state === "unavailable" || !session) {
    return (
      <Container className="pt-32 pb-24">
        <div className="mx-auto max-w-xl">
          <h1 className="font-display text-sv-h1 text-sv-text">{t("unavailable")}</h1>
          <p className="mt-4 text-sv-body-l text-sv-text-2">{t("unavailableBody")}</p>
        </div>
      </Container>
    );
  }

  if (submitted !== null && session.status !== "in_progress") {
    return (
      <Container className="pt-28 pb-24">
        {session.status === "closed" ? (
          <div className="mx-auto max-w-xl text-center">
            <h1 className="font-display text-sv-h1 text-sv-text">{t("ended")}</h1>
            <p className="mt-4 text-sv-body-l text-sv-text-2">{t("endedBody")}</p>
          </div>
        ) : (
          <Confirmation sessionId={sessionId} responseDays={submitted} />
        )}
      </Container>
    );
  }

  const inReview = session.phase === "review" && brief;
  const otherLang: "en" | "ar" = session.language === "ar" ? "en" : "ar";
  const canFinish = session.turnCount >= 4 || messages.filter((m) => m.role === "user").length >= 4;

  return (
    <Container className="pt-24 pb-10 sm:pt-28">
      <div className="sticky top-16 z-10 -mx-6 border-b border-sv-line bg-sv-base/85 px-6 py-3 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <ProgressRail phase={session.phase} progress={session.progress} />
      </div>

      {inReview ? (
        <div className="pt-8">
          <BriefReview
            sessionId={sessionId}
            brief={brief}
            onBrief={setBrief}
            onSubmitted={(days) => {
              setSubmitted(days);
              setSession({ ...session, status: "submitted" });
              track("lead_submitted", { source: "idea_lab" });
            }}
          />
        </div>
      ) : session.phase === "review" ? (
        <div className="grid min-h-[40vh] place-items-center">
          <p className="sv-label sv-label--live">{t("finishing")}</p>
        </div>
      ) : (
        <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto py-6" aria-live="polite" aria-busy={streaming} data-turn-complete={!streaming}>
            {messages.length === 0 && !streaming && (
              <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5 text-sv-body text-sv-text-2">
                {locale === "ar" ? "ابدأ بوصف المشكلة أو الفكرة بكلماتك — كما تحكيها لصديق." : "Start by describing the problem or idea in your own words — the way you would tell a friend."}
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onRetry={m.failed ? retry : undefined} />
            ))}
          </div>

          {banner && (
            <p className={cn("mb-3 rounded-sv-sm border border-sv-line bg-sv-surface-1 px-3 py-2 text-sv-small text-sv-text-2")} role="status">
              {banner}
            </p>
          )}

          <div className="sticky bottom-0 -mx-6 border-t border-sv-line bg-sv-base/90 px-6 pt-3 pb-4 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
            <Composer
              sessionId={sessionId}
              language={session.language}
              voiceProvider={voiceProvider}
              disabled={streaming || finishing}
              options={options}
              onSend={send}
              maxChars={LAB_CONVERSATION.maxMessageChars}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sv-label text-sv-text-3">
              <button type="button" onClick={() => switchLanguage(otherLang)} className="min-h-9 underline-offset-4 hover:text-sv-text hover:underline" disabled={streaming}>
                {t("languageToggle")} {otherLang === "ar" ? "العربية" : "English"}
              </button>
              {canFinish && (
                <button
                  type="button"
                  onClick={finish}
                  disabled={streaming || finishing}
                  className="min-h-9 rounded-sv-sm border border-sv-line-strong px-3 text-sv-small text-sv-text transition-colors hover:border-sv-green-line hover:text-sv-green disabled:opacity-50"
                  title={t("finishHint")}
                  data-testid="finish"
                >
                  {finishing ? t("finishing") : t("finish")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
