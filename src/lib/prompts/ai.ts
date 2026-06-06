import "server-only";
import { getAnthropic, ANTHROPIC_MODEL, hasAnthropic } from "@/lib/anthropic";
import type { Classification } from "./types";

// AI classification + optional improvement for a saved prompt. One Claude call
// (claude-opus-4-8) returns a tidy title, a single category, a few tags, and —
// when asked — a cleaner rewrite of the prompt that keeps any {{variables}}
// intact. Returns null when the model isn't connected so callers can fall back
// to saving without enrichment.

const SYSTEM = `You organize a personal library of reusable AI prompts.

Given the text of one prompt, respond with ONLY a JSON object (no prose, no code
fences) matching exactly:
{
  "title": string,        // a short, specific title, max 6 words, Title Case
  "category": string,     // ONE broad bucket, Title Case, e.g. "Writing",
                          // "Coding", "Marketing", "Research", "Email",
                          // "Analysis", "Brainstorming". Reuse common buckets.
  "tags": string[],       // 2-5 short lowercase tags
  "improved": string|null // an improved version of the prompt, or null
}

Rules for "improved":
- Only rewrite when you can make the prompt clearly better (clearer, more
  specific, better structured). If it is already good, return null.
- PRESERVE every {{variable}} placeholder exactly — same names, same casing.
- Do not invent new requirements or change the prompt's intent.
- Keep it a prompt the user sends to an AI, not a description of one.`;

function parseJson(text: string): Classification | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Partial<Classification>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const category = typeof raw.category === "string" ? raw.category.trim() : "";
    const tags = Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5)
      : [];
    const improved =
      typeof raw.improved === "string" && raw.improved.trim() ? raw.improved.trim() : null;
    if (!category && !title && tags.length === 0) return null;
    return { title, category: category || "General", tags, improved };
  } catch {
    return null;
  }
}

export async function classifyPrompt(
  body: string,
  opts?: { improve?: boolean },
): Promise<Classification | null> {
  if (!hasAnthropic()) return null;
  const anthropic = getAnthropic();
  const instruction = opts?.improve
    ? `Classify this prompt and, if you can meaningfully improve it, provide the rewrite in "improved":`
    : `Classify this prompt. Set "improved" to null:`;
  try {
    const res = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: `${instruction}\n\n${body.slice(0, 12000)}` }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return parseJson(text);
  } catch (err) {
    console.error("[stryvia] prompt classify error:", err);
    return null;
  }
}
