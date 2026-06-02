import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { ChatMessage } from "./chat/types";

// Converted-lead notification (Decisions §5, §7): the moment a visitor converts,
// an email lands immediately. Sent via Amazon SES. Custom SES_* env names are
// used instead of AWS_* so they don't collide with the reserved AWS_* variables
// the serverless runtime sets automatically. If SES isn't configured, the
// notification logs to server output so the flow stays observable in dev.

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

let sesClient: SESv2Client | null = null;

function getSes(): SESv2Client | null {
  const region = process.env.SES_REGION;
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  if (!sesClient) {
    sesClient = new SESv2Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return sesClient;
}

export async function notifyNewLead(args: NotifyArgs): Promise<boolean> {
  const to = process.env.LEAD_NOTIFY_TO;
  const from = process.env.LEAD_NOTIFY_FROM;

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

  const ses = getSes();
  if (!ses || !to || !from) {
    console.info(
      `[stryvia] lead notification (SES not configured):\n${subject}\n${body}`,
    );
    // Not delivered to a human — the caller must not treat this as captured
    // unless the lead was also persisted to the database.
    return false;
  }

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        ReplyToAddresses: [args.email],
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: { Text: { Data: body, Charset: "UTF-8" } },
          },
        },
      }),
    );
    console.info(`[stryvia] lead notification sent via SES (from ${from} to ${to})`);
    return true;
  } catch (err) {
    console.error("[stryvia] lead email (SES) failed:", err);
    return false;
  }
}
