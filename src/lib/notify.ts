import "server-only";
import type { ChatMessage } from "./chat/types";

// Converted-lead notification (Decisions §5, §7): the moment a visitor converts,
// an email lands immediately. Uses Resend if configured; otherwise logs so the
// flow is observable in development without a provider.

type NotifyArgs = {
  name: string;
  email: string;
  company?: string;
  summary?: string;
  problemCategory?: string;
  locale: string;
  conversationId: string;
  messages: ChatMessage[];
};

export async function notifyNewLead(args: NotifyArgs): Promise<void> {
  const to = process.env.LEAD_NOTIFY_TO;
  const from = process.env.LEAD_NOTIFY_FROM;
  const apiKey = process.env.RESEND_API_KEY;

  const transcript = args.messages
    .map((m) => `${m.role === "user" ? "Visitor" : "Stryvia"}: ${m.content}`)
    .join("\n\n");

  const subject = `New Stryvia lead — ${args.name}${
    args.company ? ` (${args.company})` : ""
  }`;

  const body = [
    `Name: ${args.name}`,
    `Email: ${args.email}`,
    args.company ? `Company: ${args.company}` : null,
    `Language: ${args.locale}`,
    args.problemCategory ? `Category: ${args.problemCategory}` : null,
    args.summary ? `\nSummary: ${args.summary}` : null,
    `\nConversation (${args.conversationId}):\n\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!apiKey || !to || !from) {
    console.info(`[stryvia] lead notification (email not configured):\n${subject}\n${body}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: args.email,
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      console.error("[stryvia] lead email failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[stryvia] lead email error:", err);
  }
}
