import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Server-only Anthropic client. The key is an environment secret and never
// reaches the browser. The model is pinned to claude-opus-4-8 (Spec §7) — Opus
// because the scope is the entire proof of the company; latency is handled by
// streaming, never by downgrading.
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
