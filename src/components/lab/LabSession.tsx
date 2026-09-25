"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Container } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { LAB_CONVERSATION, LAB_PATH } from "@/config/lab.config";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { attachmentLine } from "@/lib/lab/attachment-policy";
import { BriefReview } from "./BriefReview";
import { Composer } from "./Composer";
import { Confirmation } from "./Confirmation";
import { MessageBubble } from "./MessageBubble";
import { ProgressRail } from "./ProgressRail";
import {
  labFetch,
  newClientTurnId,
  readTurnStream,
  type BriefVersionInfo,
  type BriefView,
  type MessageView,
  type SessionView,
  type TurnMeta,
} from "./lab-client";

// The session screen (brief §2.3–§2.7): interview → brief review →
// confirmation, driven by server state. Every turn is persisted server-side.
// Every operation has an explicit pending / completed / failed state, a bounded
// timeout and a recovery path; after a refresh the page rebuilds that state
// from the server (busy → wait, unanswered → Retry).

type Load = { state: "loading" } | { state: "denied" } | { state: "unavailable" } | { state: "ready" };
type Payload = { ok: boolean; session: SessionView; messages: MessageView[]; brief: BriefView | null; versions: BriefVersionInfo[]; error?: string };

const TURN_TIMEOUT_MS = 100_000; // route maxDuration is 120s
const FINISH_TIMEOUT_MS = 125_000;
const POLL_MS = 3_000;

export function LabSession({ sessionId, voiceProvider }: { sessionId: string; voiceProvider: "browser" | "server" }) {
  const t = useTranslations("lab.session");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [session, setSession] = useState<SessionView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  // Handlers read the latest list from here: a state updater runs later, so
  // values assigned inside one are not available to the code after it.
  const messagesRef = useRef<MessageView[]>([]);
  messagesRef.current = messages;
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [versions, setVersions] = useState<BriefVersionInfo[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [options, setOptions] = useState<string[] | undefined>();
  const [banner, setBanner] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ version: number | null; days: number | null } | null>(null);
  const lastTurnId = useRef<string>(newClientTurnId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  const pollRef = useRef<number | null>(null);

  const fetchSession = useCallback(async (): Promise<{ status: number; data: Payload } | null> => {
    try {
      return await labFetch<Payload>(`/api/lab/session/${sessionId}`, { timeoutMs: 20_000 });
    } catch {
      return null;
    }
  }, [sessionId]);

  const applyPayload = useCallback(
    (data: Payload) => {
      setSession(data.session);
      setBrief(data.brief);
      setVersions(data.versions ?? []);
      const ms: MessageView[] = [...data.messages];
      const last = ms[ms.length - 1];
      if (data.session.status === "in_progress" && last && last.role === "user") {
        // Rebuild the operation state after a refresh: a reply is either still
        // being written (wait) or was never written (offer Retry).
        ms.push({ id: `a_recovered_${last.id}`, role: "assistant", content: "", inputMode: "text", pending: data.session.busy, failed: !data.session.busy, failedCode: "unanswered" });
      }
      setMessages(ms);
      if (data.session.status !== "in_progress") setSubmitted({ version: data.session.submittedVersion, days: data.session.responseDays });
    },
    [],
  );

  const hydrate = useCallback(async () => {
    const res = await fetchSession();
    if (!res) return setLoad({ state: "unavailable" });
    const { status, data } = res;
    if (status === 401 || status === 404) return setLoad({ state: "denied" });
    if (status === 503 || !data.ok) return setLoad({ state: "unavailable" });
    applyPayload(data);
    setLoad({ state: "ready" });
  }, [fetchSession, applyPayload]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  /** Wait (bounded) for a server-side operation to finish, then re-hydrate. */
  const waitForServer = useCallback(
    async (maxMs: number, until?: (p: Payload) => boolean) => {
      setWaiting(true);
      const started = Date.now();
      try {
        while (Date.now() - started < maxMs) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          const res = await fetchSession();
          if (!res || !res.data.ok) continue;
          if (!res.data.session.busy && (!until || until(res.data))) {
            applyPayload(res.data);
            return true;
          }
        }
        const res = await fetchSession();
        if (res?.data.ok) applyPayload(res.data);
        return false;
      } finally {
        setWaiting(false);
      }
    },
    [fetchSession, applyPayload],
  );

  useEffect(() => {
    // A reply that was still being written when the page loaded: wait for it.
    if (load.state === "ready" && session?.busy && !streaming && !waiting) void waitForServer(TURN_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.state, session?.busy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
  }, []);

  const applyMeta = useCallback((meta: TurnMeta) => {
    setSession((s) => (s ? { ...s, phase: meta.phase, progress: meta.progress, status: meta.status, busy: false } : s));
    setOptions(meta.options);
    setBanner(meta.budgetWarning ? t("budgetWarning") : null);
  }, [t]);

  const markFailed = useCallback((assistantIndex: number, code: string) => {
    setMessages((ms) => ms.map((m, i) => (i === assistantIndex ? { ...m, pending: false, failed: true, failedCode: code } : m)));
  }, []);

  const runStream = useCallback(
    async (url: string, body: Record<string, unknown>, assistantIndex: number) => {
      setStreaming(true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
      const myTurn = body.clientTurnId as string;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "same-origin",
          signal: controller.signal,
        });
        const meta = await readTurnStream(res, (text) => {
          if (lastTurnId.current !== myTurn) return; // a newer turn owns the screen
          setMessages((ms) => ms.map((m, i) => (i === assistantIndex ? { ...m, content: text } : m)));
        });
        if (lastTurnId.current !== myTurn) return; // late response for a superseded turn: ignore
        if (meta.error) {
          markFailed(assistantIndex, meta.code ?? "provider");
          applyMeta({ ...meta, status: session?.status ?? "in_progress" });
          return;
        }
        setMessages((ms) => ms.map((m, i) => (i === assistantIndex ? { ...m, pending: false, failed: false, failedCode: undefined } : m)));
        applyMeta(meta);
        if (meta.ended) setSubmitted({ version: null, days: null });
        if (meta.phase === "review") await finish();
      } catch (err) {
        if (lastTurnId.current !== myTurn) return;
        const status = (err as { status?: number }).status;
        const code = (err as { code?: string }).code;
        if ((err as Error).name === "AbortError") markFailed(assistantIndex, "timeout");
        else if (status === 409 && code === "busy") {
          // Something is still running server-side: wait for it instead of retrying blindly.
          setMessages((ms) => ms.map((m, i) => (i === assistantIndex ? { ...m, pending: true, failed: false, failedCode: "busy" } : m)));
          await waitForServer(TURN_TIMEOUT_MS);
        } else if (status === 429) markFailed(assistantIndex, "rate_limited");
        else if (status === 502 || status === 503) markFailed(assistantIndex, "provider");
        else markFailed(assistantIndex, "network");
      } finally {
        clearTimeout(timer);
        setStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyMeta, markFailed, waitForServer, session?.status],
  );

  async function send(text: string, mode: "text" | "voice", raw?: string, files: Array<{ id: string; name: string; size: number }> = []) {
    if (!session || streaming || waiting) return;
    if (!openedRef.current) {
      openedRef.current = true;
      track("chat_first_message", { source: "idea_lab" });
    }
    lastTurnId.current = newClientTurnId();
    setOptions(undefined);
    const fileLine = files.length ? attachmentLine(files.filter((f) => f.size > 0), session.language) : "";
    const user: MessageView = {
      id: `u_${lastTurnId.current}`,
      role: "user",
      content: [text, fileLine].filter(Boolean).join("\n\n") || attachmentLine(files, session.language),
      inputMode: mode,
      sentText: text,
      attachmentIds: files.map((f) => f.id),
    };
    const assistant: MessageView = { id: `a_${lastTurnId.current}`, role: "assistant", content: "", inputMode: "text", pending: true };
    const assistantIndex = messagesRef.current.length + 1;
    messagesRef.current = [...messagesRef.current, user, assistant];
    setMessages((ms) => [...ms, user, assistant]);
    await runStream(`/api/lab/session/${sessionId}/turn`, { content: text, inputMode: mode, transcriptRaw: raw ?? null, clientTurnId: lastTurnId.current, attachmentIds: files.map((f) => f.id) }, assistantIndex);
  }

  async function retry() {
    if (!session || streaming || waiting) return;
    let assistantIndex = -1;
    let resend: { text: string; mode: "text" | "voice"; attachmentIds: string[] } | null = null;
    const current = messagesRef.current;
    const idx = current.findIndex((m) => m.failed);
    if (idx === -1) return;
    assistantIndex = idx;
    const clientUserCount = current.slice(0, idx).filter((m) => m.role === "user").length;
    const prev = current[idx - 1];
    // Only a message sent from this page can be re-sent; one recovered from
    // the server after a refresh is by definition already stored.
    if (prev && prev.role === "user" && prev.sentText !== undefined) {
      resend = { text: prev.sentText, mode: prev.inputMode, attachmentIds: prev.attachmentIds ?? [] };
    }
    setMessages((ms) => ms.map((m, i) => (i === idx ? { ...m, content: "", failed: false, failedCode: undefined, pending: true } : m)));
    lastTurnId.current = newClientTurnId();
    // Did the visitor's message reach the server? A request cut off before any
    // response may never have been persisted. Compare with what the server
    // holds: if it is missing, re-send it as a new turn; if it is there,
    // regenerate the reply. Either way the transcript gains nothing twice.
    // Counting (not comparing text) keeps two identical short answers apart.
    // The check itself is an active state: the bubble stays "thinking" and the
    // composer stays locked until the regenerated reply is in.
    setStreaming(true);
    const fresh = await fetchSession().finally(() => setStreaming(false));
    const serverUserCount = fresh?.data.ok ? fresh.data.messages.filter((m) => m.role === "user").length : clientUserCount;
    const r = resend as { text: string; mode: "text" | "voice"; attachmentIds: string[] } | null;
    if (r && serverUserCount < clientUserCount) {
      await runStream(`/api/lab/session/${sessionId}/turn`, { content: r.text, inputMode: r.mode, transcriptRaw: null, clientTurnId: lastTurnId.current, attachmentIds: r.attachmentIds }, assistantIndex);
      return;
    }
    await runStream(`/api/lab/session/${sessionId}/retry`, { clientTurnId: lastTurnId.current }, assistantIndex);
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setBanner(null);
    try {
      const { status, data } = await labFetch<{ ok: boolean; brief?: BriefView; versions?: BriefVersionInfo[]; error?: string }>(
        `/api/lab/session/${sessionId}/finish`,
        { method: "POST", timeoutMs: FINISH_TIMEOUT_MS },
      );
      if (data.ok && data.brief) {
        setBrief(data.brief);
        setVersions(data.versions ?? []);
        setSession((s) => (s ? { ...s, phase: "review", progress: 0.95, busy: false } : s));
        track("chat_scope_returned", { source: "idea_lab" });
      } else if (status === 409 && data.error === "busy") {
        // Another request (auto-finish + the button, or a refresh) is writing it.
        setBanner(t("finishBusy"));
        await waitForServer(FINISH_TIMEOUT_MS, (p) => Boolean(p.brief));
        setBanner(null);
      } else {
        setBanner(t("errorTurn"));
      }
    } catch {
      setBanner(t("errorTimeout"));
      await waitForServer(FINISH_TIMEOUT_MS, (p) => Boolean(p.brief));
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
        <div className="mx-auto max-w-xl" data-lab-state="denied">
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
        <div className="mx-auto max-w-xl" data-lab-state="unavailable">
          <h1 className="font-display text-sv-h1 text-sv-text">{t("unavailable")}</h1>
          <p className="mt-4 text-sv-body-l text-sv-text-2">{t("unavailableBody")}</p>
          <div className="mt-8">
            <Button variant="secondary" onClick={() => { setLoad({ state: "loading" }); void hydrate(); }}>{t("retry")}</Button>
          </div>
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
          <Confirmation sessionId={sessionId} responseDays={submitted.days} submittedVersion={submitted.version} />
        )}
      </Container>
    );
  }

  const inReview = session.phase === "review" && brief;
  const otherLang: "en" | "ar" = session.language === "ar" ? "en" : "ar";
  const canFinish = session.turnCount >= 4 || messages.filter((m) => m.role === "user").length >= 4;
  const hasFailed = messages.some((m) => m.failed);

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
            versions={versions}
            onBrief={(b, v) => {
              setBrief(b);
              if (v) setVersions(v);
            }}
            onReload={hydrate}
            onSubmitted={(version, days) => {
              setSubmitted({ version, days });
              setSession({ ...session, status: "submitted", submittedVersion: version });
              track("lead_submitted", { source: "idea_lab" });
            }}
          />
        </div>
      ) : session.phase === "review" ? (
        <div className="grid min-h-[40vh] place-items-center">
          <div className="text-center">
            <p className="sv-label sv-label--live">{finishing || waiting ? t("finishing") : t("finishing")}</p>
            {!finishing && !waiting && (
              <div className="mt-6">
                <Button variant="secondary" onClick={finish}>{t("retry")}</Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto py-6" aria-live="polite" aria-busy={streaming || waiting} data-turn-complete={!streaming && !waiting}>
            {messages.length === 0 && !streaming && (
              <div className="rounded-sv-md border border-sv-line bg-sv-surface-1 p-5 text-sv-body text-sv-text-2">
                {locale === "ar" ? "ابدأ بوصف المشكلة أو الفكرة بكلماتك — كما تحكيها لصديق." : "Start by describing the problem or idea in your own words — the way you would tell a friend."}
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onRetry={m.failed && !streaming && !waiting ? retry : undefined} />
            ))}
          </div>

          {(banner || waiting) && (
            <p className={cn("mb-3 rounded-sv-sm border border-sv-line bg-sv-surface-1 px-3 py-2 text-sv-small text-sv-text-2")} role="status">
              {banner ?? t("waitingServer")}
            </p>
          )}

          <div className="sticky bottom-0 -mx-6 border-t border-sv-line bg-sv-base/90 px-6 pt-3 pb-4 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
            <Composer
              sessionId={sessionId}
              language={session.language}
              voiceProvider={voiceProvider}
              disabled={streaming || finishing || waiting || hasFailed}
              options={options}
              onSend={send}
              maxChars={LAB_CONVERSATION.maxMessageChars}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sv-label text-sv-text-3">
              <button type="button" onClick={() => switchLanguage(otherLang)} className="min-h-9 underline-offset-4 hover:text-sv-text hover:underline" disabled={streaming || waiting}>
                {t("languageToggle")} {otherLang === "ar" ? "العربية" : "English"}
              </button>
              {canFinish && (
                <button
                  type="button"
                  onClick={finish}
                  disabled={streaming || finishing || waiting || hasFailed}
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
