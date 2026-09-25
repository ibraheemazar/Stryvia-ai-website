import type { NextRequest } from "next/server";
import { AttachmentError, confirmAttachmentUpload } from "@/lib/lab/attachments";
import { labEvent } from "@/lib/lab/events";
import { json, ownerOr, withLabRoute } from "@/lib/lab/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Confirm an upload: the server checks the object really exists in private
// storage before the file counts as received. The visitor gets back only the
// name and size, never a storage path or a download link.
export const POST = withLabRoute<{ id: string; attachmentId: string }>("lab.session.attachments.confirm", async (req: NextRequest, { params, requestId }) => {
  const owner = await ownerOr(req, params.id);
  if (!owner.ok) return owner.res!;
  const { session } = owner;
  try {
    const att = await confirmAttachmentUpload(session.id, params.attachmentId);
    await labEvent("attachment.stored", "info", { sessionId: session.id, requestId, payload: { count: 1, kind: att.kind } });
    return json({ ok: true, attachment: { id: att.id, name: att.file_name, size: att.size_bytes, mime: att.mime_type, status: att.status } });
  } catch (err) {
    if (err instanceof AttachmentError) return json({ ok: false, error: err.reason }, err.reason === "not_found" ? 404 : 409);
    throw err;
  }
});
