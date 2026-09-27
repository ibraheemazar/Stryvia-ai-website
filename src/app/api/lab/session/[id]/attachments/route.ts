import type { NextRequest } from "next/server";
import { z } from "zod";
import { ATTACHMENT_LIMITS } from "@/lib/lab/attachment-policy";
import { AttachmentError, createAttachmentUpload } from "@/lib/lab/attachments";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, readJson, withLabRoute } from "@/lib/lab/http";
import { hashKey, isRateLimited } from "@/lib/lab/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reserve an attachment and hand back a signed upload URL. The browser sends
// the bytes straight to private storage, then calls …/attachments/:id to
// confirm. Every file is kept for Stryvia's team (owner requirement); only
// executables and scripts are refused.

const Schema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(200).default(""),
  size: z.number().int().positive().max(ATTACHMENT_LIMITS.maxBytes),
});

const STATUS: Record<string, number> = { blocked_type: 415, too_large: 413, empty: 400, bad_name: 400, limit_files: 409, limit_bytes: 409, storage: 502 };

export const POST = withLabRoute<{ id: string }>("lab.session.attachments.create", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  if (session.status !== "in_progress") return json({ ok: false, error: "not_in_progress" }, 409);
  if (await isRateLimited(hashKey("attach", session.id), 30, 600)) return json({ ok: false, error: "rate_limited" }, 429);
  const parsed = await readJson(req, Schema);
  if (!parsed.ok) {
    // A size above the limit fails validation; say so plainly.
    return json({ ok: false, error: "too_large", maxBytes: ATTACHMENT_LIMITS.maxBytes }, 413);
  }
  try {
    const { attachment, uploadUrl } = await createAttachmentUpload(session.id, parsed.data);
    await labEvent("attachment.reserved", "info", { sessionId: session.id, requestId, payload: { count: 1, kind: "file" } });
    return json({ ok: true, attachment: { id: attachment.id, name: attachment.file_name, size: attachment.size_bytes, mime: attachment.mime_type }, uploadUrl });
  } catch (err) {
    if (err instanceof AttachmentError) return json({ ok: false, error: err.reason, maxBytes: ATTACHMENT_LIMITS.maxBytes }, STATUS[err.reason] ?? 400);
    throw err;
  }
});
