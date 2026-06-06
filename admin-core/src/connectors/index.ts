import "server-only";

// Channel connectors. Each reads its credentials from the environment and is
// fully functional the moment those are present — "built now, activates on
// keys." When unconfigured they no-op and report it, never fail loudly.

export function providerConfigured(provider: string): boolean {
  switch (provider) {
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "supabase":
      return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    case "posthog":
      return !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
    case "ses":
      return !!(
        process.env.SES_REGION &&
        process.env.SES_ACCESS_KEY_ID &&
        process.env.SES_SECRET_ACCESS_KEY &&
        process.env.EMAIL_FROM
      );
    case "slack":
      return !!process.env.SLACK_WEBHOOK_URL;
    case "whatsapp":
      return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    case "sms":
      return !!(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM
      );
    case "ga4":
      return !!process.env.GA4_PROPERTY_ID && !!process.env.GA4_CREDENTIALS_JSON;
    default:
      // Other platforms wired via their own OAuth apps; reported by env flag.
      return !!process.env[`${provider.toUpperCase()}_CONNECTED`];
  }
}

export async function slackNotify(text: string): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch (err) {
    console.error("[admin-core] slack notify failed:", err);
    return false;
  }
}

// WhatsApp via the Meta Cloud API. Sends a plain text message to an E.164 number.
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId || !to) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d+]/g, ""),
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) console.error("[admin-core] whatsapp failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[admin-core] whatsapp error:", err);
    return false;
  }
}

// SMS via Twilio.
export async function sendSMS(to: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from || !to) return false;
  try {
    const body = new URLSearchParams({ To: to, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) console.error("[admin-core] sms failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[admin-core] sms error:", err);
    return false;
  }
}

// Email via Amazon SES v2. The AWS SDK is a peer/optional dependency, imported
// lazily so the connector doesn't force the dep on sites that don't send email.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): Promise<boolean> {
  const region = process.env.SES_REGION;
  const from = opts.from || process.env.EMAIL_FROM;
  if (!region || !from || !process.env.SES_ACCESS_KEY_ID) return false;
  try {
    const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
    const client = new SESv2Client({
      region,
      credentials: {
        accessKeyId: process.env.SES_ACCESS_KEY_ID!,
        secretAccessKey: process.env.SES_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [opts.to] },
        Content: {
          Simple: {
            Subject: { Data: opts.subject },
            Body: { Text: { Data: opts.body } },
          },
        },
      }),
    );
    return true;
  } catch (err) {
    console.error("[admin-core] email send failed:", err);
    return false;
  }
}

export async function webhookPost(url: string, payload: unknown): Promise<boolean> {
  if (!url) return false;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.error("[admin-core] webhook error:", err);
    return false;
  }
}
