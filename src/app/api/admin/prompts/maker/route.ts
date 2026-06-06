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

// The AI "maker": describe the prompt you want and Claude drafts a clean,
// reusable one. It always emits the finished prompt inside a ```prompt fenced
// block so the UI can offer a one-click "Save to library" on it. Variables are
// expressed as {{snake_case}} so a near-identical prompt is written once and
// only the blanks change later. The operator may attach images, PDFs or Word
// docs — Claude reads them and turns them into a prompt.
const MAKER_SYSTEM = `You are a prompt engineer helping build a personal library of reusable prompts.

The user describes a task they want a prompt for, pastes a rough prompt to refine,
or attaches files (images, PDFs, Word docs) to turn into a prompt.
You write an excellent, reusable prompt they can send to an AI like Claude.

ALWAYS follow this output shape:
1. One short sentence on what the prompt does and how to reuse it.
2. The finished prompt inside a fenced block tagged \`prompt\`, like:
\`\`\`prompt
<the prompt text>
\`\`\`

Guidelines for the prompt you write:
- Make anything that changes between uses a {{variable}} in snake_case
  (e.g. {{topic}}, {{audience}}, {{tone}}). This is the whole point — the user
  reuses the prompt and only fills the blanks.
- When the user attaches a file, read it carefully and base the prompt on its
  actual content (structure, intent, style).
- Be specific and well-structured; include role, task, constraints, and desired
  output format when useful.
- Do not add commentary inside a \`prompt\` block — only the prompt text.
- If the user asks for SEPARATE prompts (e.g. one per attached image/file),
  output ONE fenced \`prompt\` block per prompt, each preceded by a short title
  line saying which file it is for. The user saves each block individually.
- Otherwise, return a single \`prompt\` block.
- If the user asks to tweak the previous draft, return the full updated prompt
  in a new \`prompt\` block.`;

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

  return streamClaudeMessages(MAKER_SYSTEM, params);
}
