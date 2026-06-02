"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale } from "next-intl";
import { track } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";
import type { ChatMessage, ChatSignal } from "@/lib/chat/types";

const RS = "\x1e";
// The focus-pull moment must feel deliberate (A.8): hold the status stack for at
// least this long even when the model is fast, because the focusing is the proof.
const MIN_FOCUS_MS = 1800;

type Phase = "idle" | "focusing" | "streaming";

type ChatState = {
  isOpen: boolean;
  conversationId: string | null;
  messages: ChatMessage[];
  phase: Phase;
  signal: ChatSignal;
  error: boolean;
  converted: boolean;
  pageContext: string;
  hasStarted: boolean;
};

type ChatContextValue = ChatState & {
  open: (opts?: { pageContext?: string; seed?: string }) => void;
  close: () => void;
  setPageContext: (ctx: string) => void;
  send: (text: string) => Promise<void>;
  markConverted: () => void;
  reset: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const [state, setState] = useState<ChatState>({
    isOpen: false,
    conversationId: null,
    messages: [],
    phase: "idle",
    signal: null,
    error: false,
    converted: false,
    pageContext: "",
    hasStarted: false,
  });

  const sendingRef = useRef(false);

  const setPageContext = useCallback((ctx: string) => {
    setState((s) => (s.pageContext === ctx ? s : { ...s, pageContext: ctx }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;
      sendingRef.current = true;

      const firstMessage = state.messages.length === 0;
      if (firstMessage) track("chat_first_message", { locale, page: state.pageContext });

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const baseMessages = [...state.messages, userMsg];

      setState((s) => ({
        ...s,
        messages: [...baseMessages, { role: "assistant", content: "" }],
        phase: "focusing",
        signal: null,
        error: false,
        hasStarted: true,
      }));

      const focusStart = Date.now();
      let buffer = "";
      let revealed = false;

      const reveal = () => {
        revealed = true;
        setState((s) => {
          const next = [...s.messages];
          next[next.length - 1] = { role: "assistant", content: buffer };
          return { ...s, phase: "streaming", messages: next };
        });
      };

      const focusTimer = setTimeout(() => {
        if (!revealed) reveal();
      }, MIN_FOCUS_MS);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: baseMessages,
            locale,
            pageContext: state.pageContext,
            conversationId: state.conversationId,
            attribution: getAttribution(),
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`chat ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let metaRaw = "";
        let sawRS = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          for (const ch of chunk) {
            if (ch === RS) {
              sawRS = true;
              continue;
            }
            if (sawRS) {
              metaRaw += ch;
            } else {
              buffer += ch;
            }
          }

          const elapsed = Date.now() - focusStart;
          if (!revealed && elapsed >= MIN_FOCUS_MS) {
            reveal();
          } else if (revealed) {
            setState((s) => {
              const next = [...s.messages];
              next[next.length - 1] = { role: "assistant", content: buffer };
              return { ...s, messages: next };
            });
          }
        }

        clearTimeout(focusTimer);
        if (!revealed) reveal();

        let signal: ChatSignal = null;
        let convId: string | null = state.conversationId;
        let errored = false;
        try {
          const meta = JSON.parse(metaRaw);
          signal = meta.signal ?? null;
          convId = meta.conversationId ?? convId;
          errored = Boolean(meta.error);
          if (errored) {
            console.error("[stryvia] chat error:", meta.status, meta.detail);
          }
        } catch {
          /* no metadata frame */
        }

        // A failed model call with no streamed text becomes an error state,
        // never a silent empty bubble.
        if (errored && buffer.trim().length === 0) {
          setState((s) => {
            const next = [...s.messages];
            if (
              next.length &&
              next[next.length - 1].role === "assistant" &&
              !next[next.length - 1].content
            ) {
              next.pop();
            }
            return { ...s, messages: next, phase: "idle", error: true };
          });
        } else {
          setState((s) => {
            const next = [...s.messages];
            next[next.length - 1] = { role: "assistant", content: buffer };
            return {
              ...s,
              messages: next,
              phase: "idle",
              signal,
              conversationId: convId,
            };
          });
        }

        track("chat_scope_returned", { locale });
        if (signal === "ready") track("chat_muscle_shown", { locale });
        if (signal === "human") track("chat_escalated_to_human", { locale });
      } catch (err) {
        console.error("[stryvia] chat send failed:", err);
        clearTimeout(focusTimer);
        setState((s) => {
          const next = [...s.messages];
          // drop the empty assistant placeholder
          if (next.length && next[next.length - 1].role === "assistant" && !next[next.length - 1].content) {
            next.pop();
          }
          return { ...s, messages: next, phase: "idle", error: true };
        });
      } finally {
        sendingRef.current = false;
      }
    },
    [locale, state.messages, state.pageContext, state.conversationId],
  );

  const open = useCallback(
    (opts?: { pageContext?: string; seed?: string }) => {
      setState((s) => ({
        ...s,
        isOpen: true,
        pageContext: opts?.pageContext ?? s.pageContext,
      }));
      track("chat_opened", { locale });
      if (opts?.seed) {
        // Allow state to settle, then send the seeded problem.
        setTimeout(() => void send(opts.seed as string), 50);
      }
    },
    [locale, send],
  );

  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);
  const markConverted = useCallback(
    () => setState((s) => ({ ...s, converted: true })),
    [],
  );
  const reset = useCallback(
    () =>
      setState((s) => ({
        ...s,
        conversationId: null,
        messages: [],
        phase: "idle",
        signal: null,
        error: false,
        converted: false,
        hasStarted: false,
      })),
    [],
  );

  const value = useMemo<ChatContextValue>(
    () => ({ ...state, open, close, setPageContext, send, markConverted, reset }),
    [state, open, close, setPageContext, send, markConverted, reset],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
