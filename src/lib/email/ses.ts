import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// Shared SES v2 sender with HTML + text parts. Existing lead/marketing mail
// keeps its own plain-text paths; the Lab (and anything new) uses this.

let client: SESv2Client | null = null;

export function sesConfigured(): boolean {
  return Boolean(
    process.env.SES_REGION &&
      process.env.SES_ACCESS_KEY_ID &&
      process.env.SES_SECRET_ACCESS_KEY &&
      process.env.LEAD_NOTIFY_FROM,
  );
}

function getClient(): SESv2Client | null {
  const region = process.env.SES_REGION;
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  client ??= new SESv2Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return client;
}

export type OutboundEmail = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  from?: string;
};

/** Sends via SES; returns the message id or null when SES is not configured. */
export async function sendSesEmail(mail: OutboundEmail): Promise<string | null> {
  const ses = getClient();
  const from = mail.from ?? process.env.LEAD_NOTIFY_FROM;
  if (!ses || !from) return null;
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  const res = await ses.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: to },
      ReplyToAddresses: mail.replyTo ? [mail.replyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: mail.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: mail.html, Charset: "UTF-8" },
            Text: { Data: mail.text, Charset: "UTF-8" },
          },
        },
      },
    }),
  );
  return res.MessageId ?? "sent";
}
