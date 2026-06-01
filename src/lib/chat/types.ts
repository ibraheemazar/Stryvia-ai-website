// Shared Chat types, used by the client panel and the server routes.

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

// Control signal the model emits on a final line; the server strips it from
// the visible text and returns it as a state the client acts on.
export type ChatSignal = "ready" | "human" | "more" | null;

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_path?: string;
};

export type ChatRequestBody = {
  messages: ChatMessage[];
  locale: string;
  pageContext?: string;
  conversationId?: string;
  attribution?: Attribution;
};

export type LeadRequestBody = {
  conversationId: string;
  name: string;
  email: string;
  company?: string;
  messages: ChatMessage[];
  locale: string;
  pageContext?: string;
};

export type EarlyAccessBody = {
  name?: string;
  email: string;
  context?: string;
  locale: string;
};
