import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { verifyAdmin } from "@/lib/admin-auth";
import { streamClaudeMessages, clampMessages } from "@/lib/insights/stream";
import { attachmentsToBlocks } from "@/lib/prompts/attachments";
import type { ChatMessage } from "@/lib/chat/types";
import type { MakerAttachment } from "@/lib/prompts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The AI "maker" for the prompt library. Its DEFAULT job is to capture prompts
// faithfully — exactly as the operator provides them (typed, pasted, or inside
// attached images / PDFs / Word docs). It only writes or optimizes a prompt
// when the operator explicitly asks. Every prompt is emitted inside a ```prompt
// fenced block so the UI can offer one-click Copy / Save / Optimize.
const MAKER_SYSTEM = `You help an operator build a personal library of reusable prompts.

DEFAULT BEHAVIOR — CAPTURE EXACTLY, DO NOT CHANGE:
When the user pastes prompt text, or attaches files/images that contain prompts,
reproduce each prompt EXACTLY as given. Do NOT rewrite it, expand it, make it more
specific, add examples, change the wording, or "improve" it in any way. Preserve
its generality and every {{placeholder}} verbatim. If an image or document
contains a prompt, transcribe it word-for-word. This is the most important rule.

ONLY refine or generate when EXPLICITLY asked:
- If the user explicitly says "optimize", "improve", "make it better", "refine",
  then return an improved version — kept reusable and generic with {{snake_case}}
  variables, never baking in specific details.
- If the user asks you to "write/create a prompt for <description>" with no
  source prompt to capture, then draft one.

OUTPUT SHAPE:
1. One short sentence (e.g. "Captured 3 prompts." or "Here's the optimized version.").
2. Each prompt inside its OWN fenced block tagged \`prompt\`:
\`\`\`prompt
<the prompt text>
\`\`\`
When there are several prompts (e.g. one per attached image), output one
\`prompt\` block per prompt, each preceded by a short title line. The user saves
each block individually. Never put commentary inside a \`prompt\` block.`;

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  let body: { messages?: ChatMessage[]; attachments?: MakerAttachment[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const messages = clampMessages(body.messages ?? []);
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (messages.length === 0 && attachments.length === 0) {
    return NextResponse.json({ ok: false, error: "no message" }, { status: 400 });
  }

  // Build the message params, attaching any files to the final user turn so
  // Claude reads them alongside the request.
  const params: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (attachments.length > 0) {
    const blocks = await attachmentsToBlocks(attachments);
    const lastText =
      params.length && params[params.length - 1].role === "user"
        ? (params.pop()!.content as string)
        : "Read the attached file(s) and create a reusable prompt based on them.";
    params.push({ role: "user", content: [...blocks, { type: "text", text: lastText }] });
  }

  // A generous budget so several prompts (e.g. one per attached image) all fit
  // in one response without the last block being truncated.
  return streamClaudeMessages(MAKER_SYSTEM, params, { maxTokens: 8000 });
}
