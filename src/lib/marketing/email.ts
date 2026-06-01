import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// Marketing email send via Amazon SES (same provider as lead notifications).
// Sends individually so recipients are never exposed to each other.

let client: SESv2Client | null = null;
function ses(): SESv2Client | null {
  const region = process.env.SES_REGION;
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  if (!client) client = new SESv2Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return client;
}

export function sesConfigured(): boolean {
  return Boolean(
    process.env.SES_REGION &&
      process.env.SES_ACCESS_KEY_ID &&
      process.env.SES_SECRET_ACCESS_KEY &&
      process.env.LEAD_NOTIFY_FROM,
  );
}

export async function sendMarketingEmail(
  recipients: { email: string; name?: string }[],
  subject: string,
  body: string,
): Promise<{ sent: number; failed: number }> {
  const c = ses();
  const from = process.env.LEAD_NOTIFY_FROM;
  if (!c || !from) {
    console.info(`[stryvia] marketing email (SES not configured) to ${recipients.length}: ${subject}`);
    return { sent: 0, failed: recipients.length };
  }

  let sent = 0;
  let failed = 0;
  // Cap per run to stay within sandbox/rate limits; the rest can be re-sent.
  for (const r of recipients.slice(0, 200)) {
    try {
      await c.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [r.email] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: "UTF-8" },
              Body: { Text: { Data: body, Charset: "UTF-8" } },
            },
          },
        }),
      );
      sent++;
    } catch (err) {
      failed++;
      console.error("[stryvia] marketing email failed:", err);
    }
  }
  return { sent, failed };
}
