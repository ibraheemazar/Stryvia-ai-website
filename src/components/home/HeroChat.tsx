"use client";

import { useEffect } from "react";
import { useChat } from "@/components/chat/ChatProvider";
import { ChatPanel } from "@/components/chat/ChatPanel";

// The homepage hero Chat instance. Page context is left blank on the homepage
// per Part B; the panel itself carries the bracket frame and focus-in.
export function HeroChat() {
  const { setPageContext } = useChat();
  useEffect(() => {
    setPageContext("");
  }, [setPageContext]);

  return <ChatPanel variant="hero" className="sv-glow" />;
}
