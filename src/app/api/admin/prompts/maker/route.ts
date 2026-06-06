import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { streamClaude, clampMessages } from "@/lib/insights/stream";
import type { ChatMessage } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The AI "maker": describe the prompt you want and Claude drafts a clean,
// reusable one. It always emits the finished prompt inside a ```prompt fenced
// block so the UI can offer a one-click "Save to library" on it. Variables are
// expressed as {{snake_case}} so a near-identical prompt is written once and
// only the blanks change later.
const MAKER_SYSTEM = `You are a prompt engineer helping build a personal library of reusable prompts.

The user describes a task they want a prompt for (or pastes a rough prompt to refine).
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
- Be specific and well-structured; include role, task, constraints, and desired
  output format when useful.
- Keep it to a single fenced \`prompt\` block. Do not add commentary inside the block.
- If the user asks to tweak the previous draft, return the full updated prompt
  in a new \`prompt\` block.`;

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const messages = clampMessages(body.messages ?? []);
  if (messages.length === 0) {
    return NextResponse.json({ ok: false, error: "no message" }, { status: 400 });
  }

  return streamClaude(MAKER_SYSTEM, messages);
}
