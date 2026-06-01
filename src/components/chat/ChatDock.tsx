"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useChat } from "./ChatProvider";
import { ChatPanel } from "./ChatPanel";
import { cn } from "@/lib/utils";

// Persistent docked Chat affordance (D.1 / F): a single prominent button when
// collapsed, expanding to a docked panel on desktop and a full-screen takeover
// on mobile. Hidden where the Chat already occupies the page.
const HIDE_ON = ["/", "/start"];

export function ChatDock() {
  const t = useTranslations("chat");
  const nav = useTranslations("nav");
  const pathname = usePathname();
  const { isOpen, open, close } = useChat();

  if (HIDE_ON.includes(pathname)) return null;

  return (
    <>
      {/* Collapsed button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => open()}
          className="group fixed bottom-5 end-5 z-40 flex items-center gap-2.5 rounded-sv-pill border border-sv-green-line bg-sv-surface-1/90 px-4 py-3 backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--sv-focus-ring)]"
          aria-label={t("emptyPrompt")}
        >
          <span className="sv-live-dot" />
          <span className="sv-label sv-label--live">{t("title")}</span>
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-40",
            "inset-0 sm:inset-auto sm:bottom-5 sm:end-5 sm:h-[min(36rem,80vh)] sm:w-[26rem]",
          )}
        >
          <div className="relative flex h-full flex-col">
            <button
              type="button"
              onClick={close}
              className="absolute end-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-sv-sm text-sv-text-2 transition-colors hover:text-sv-text"
              aria-label={nav("closeMenu")}
            >
              <span className="text-xl leading-none">×</span>
            </button>
            <ChatPanel variant="dock" className="h-full" />
          </div>
        </div>
      )}
    </>
  );
}
