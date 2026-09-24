import "server-only";
import { getLabSettings } from "./env";
import { labLog } from "./log";

// Cloudflare Turnstile verification (brief §9). When Turnstile is disabled by
// explicit configuration the check passes; when it is enabled a missing or
// invalid token fails closed.

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const { turnstile } = getLabSettings();
  if (!turnstile.enabled || !turnstile.secretKey) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: turnstile.secretKey, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(6000),
    });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!json.success) labLog("warn", "turnstile.rejected", { codes: json["error-codes"] });
    return json.success === true;
  } catch (err) {
    labLog("error", "turnstile.verify_failed", { error: err as Error });
    return false;
  }
}
