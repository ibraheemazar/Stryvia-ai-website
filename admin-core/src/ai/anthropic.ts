import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Server-only Anthropic client. The key is an environment secret and never
// reaches the browser. Default model is the latest Opus; override per site with
// ANTHROPIC_MODEL.
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
