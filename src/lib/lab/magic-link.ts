import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { LAB_LIMITS } from "@/config/lab.config";
import { consumeMagicLinkRow, insertMagicLink, peekMagicLink } from "./store";

// Single-use, expiring magic links (brief §2.2). Only a sha256 hash of the
// token is stored; the token itself travels once, in the email.

export type MagicPurpose = "resume" | "delete";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMagicLink(
  email: string,
  purpose: MagicPurpose,
  ipHash?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LAB_LIMITS.magicLinkTtlHours * 60 * 60 * 1000);
  await insertMagicLink({
    token_hash: hashToken(token),
    email: email.trim().toLowerCase(),
    purpose,
    expires_at: expiresAt.toISOString(),
    created_ip_hash: ipHash ?? null,
  });
  return { token, expiresAt };
}

/** Is the token currently valid (not used, not expired)? Does not consume it. */
export async function magicLinkIsValid(token: string, purpose: MagicPurpose): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return false;
  return peekMagicLink(hashToken(token), purpose);
}

/** Consume the token; returns the email or null if invalid/used/expired. */
export async function consumeMagicLink(token: string, purpose: MagicPurpose): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const row = await consumeMagicLinkRow(hashToken(token), purpose);
  return row?.email ?? null;
}
