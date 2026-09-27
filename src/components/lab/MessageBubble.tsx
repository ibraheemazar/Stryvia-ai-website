"use client";

import { useTranslations } from "next-intl";
import { Markdown } from "@/components/chat/Markdown";
import { cn } from "@/lib/utils";
import { textDir, type MessageView } from "./lab-client";

// One transcript entry. `dir` follows the message's own script so mixed
// Arabic/English sessions read correctly regardless of the UI locale.
export function MessageBubble({ message, onRetry }: { message: MessageView; onRetry?: () => void }) {
  const t = useTranslations("lab.session");
  const isUser = message.role === "user";
  const dir = textDir(message.content);

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")} data-role={message.role} data-pending={message.pending ? "true" : undefined} data-failed={message.failed ? "true" : undefined}>
      <div className={cn("max-w-[88%] sm:max-w-[78%]", isUser ? "text-end" : "text-start")}>
        <p className={cn("sv-label mb-1.5", isUser ? "text-sv-text-3" : "sv-label--live")}>
          {isUser ? t("you") : t("ai")}
          {message.inputMode === "voice" && <span className="ms-2 font-mono text-sv-label-sm text-sv-text-3">◉</span>}
        </p>
        <div
          dir={dir}
          data-sv-mask
          className={cn(
            "rounded-sv-md px-4 py-3 text-sv-body leading-relaxed text-start",
            isUser ? "border border-sv-line bg-sv-surface-3 text-sv-text" : "text-sv-text",
            message.pending && !message.content && "min-h-11",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <>
              <Markdown text={message.content} />
              {message.pending && <span className="sv-stream-caret" aria-hidden />}
            </>
          ) : message.pending ? (
            <span className="flex items-center gap-2 text-sv-text-3">
              <span className="sv-live-dot" aria-hidden />
              {message.failedCode === "busy" ? t("errorBusy") : t("thinking")}
            </span>
          ) : null}
        </div>
        {message.failed && onRetry && (
          <div className="mt-2 flex items-center gap-3 text-sv-small text-sv-text-2">
            <span>
              {message.failedCode === "provider"
                ? t("errorProvider")
                : message.failedCode === "timeout"
                  ? t("errorTimeout")
                  : message.failedCode === "interrupted" || message.failedCode === "superseded"
                    ? t("errorInterrupted")
                    : message.failedCode === "unanswered"
                      ? t("errorUnanswered")
                      : t("errorTurn")}
            </span>
            <button type="button" onClick={onRetry} className="min-h-9 rounded-sv-sm border border-sv-line-strong px-3 text-sv-text hover:border-sv-green-line hover:text-sv-green">
              {t("retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
