"use client";

import { useChat } from "./ChatProvider";
import { Button } from "@/components/ui/Button";

// A button that opens/seeds the Chat with a problem framing — used by the
// homepage scenes and audience doors so any CTA flows back to the conversation.
export function ChatSeedButton({
  seed,
  pageContext,
  children,
  variant = "ghost",
  arrow = true,
  className,
  scrollToHero = true,
}: {
  seed?: string;
  pageContext?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  arrow?: boolean;
  className?: string;
  scrollToHero?: boolean;
}) {
  const { open, send, setPageContext } = useChat();

  return (
    <Button
      variant={variant}
      arrow={arrow}
      className={className}
      onClick={() => {
        if (pageContext) setPageContext(pageContext);
        if (scrollToHero && typeof document !== "undefined") {
          document.getElementById("hero-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (seed) {
          // Seed directly into the shared conversation.
          void send(seed);
        }
        open({ pageContext });
      }}
    >
      {children}
    </Button>
  );
}
