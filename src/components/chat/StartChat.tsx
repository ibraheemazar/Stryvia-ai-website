"use client";

import { useEffect } from "react";
import { useChat } from "./ChatProvider";
import { ChatPanel } from "./ChatPanel";

// The Start page chat — the conversion endpoint (Spec §6.23). Seeded with the
// start context so the first response is sharp.
export function StartChat() {
  const { setPageContext } = useChat();
  useEffect(() => {
    setPageContext("the Start page — the visitor came here to begin");
  }, [setPageContext]);

  return <ChatPanel variant="hero" className="min-h-[34rem]" />;
}
