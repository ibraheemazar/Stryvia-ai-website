import "server-only";
import { randomUUID } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase";
import { ATTACHMENT_LIMITS, checkAttachment, storageName, type AttachmentCheck } from "./attachment-policy";

// Every file a visitor sends is kept (owner requirement). Bytes go to the
// PRIVATE bucket `lab-attachments` (no storage policies: only the service
// role can touch it); one `lab_attachments` row per file records the original
// name, type, size, the message it was sent with and where it lives.
//
// Upload path: the browser asks this server for a signed upload URL, sends
// the file straight to storage (Vercel functions cap request bodies at
// ~4.5 MB, far below real brochures and videos), then asks the server to
// confirm; the server verifies the object exists and its size before marking
// the row `stored`. Voice recordings that reach the transcription route are
// stored from the server directly.

export const ATTACHMENT_BUCKET = "lab-attachments";

export type LabAttachmentRow = {
  id: string;
  session_id: string;
  message_id: string | null;
  kind: "file" | "voice";
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  status: "pending" | "stored";
  created_at: string;
  stored_at: string | null;
};

function db() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured.");
  return supabase;
}

export type AttachmentErrorReason = Extract<AttachmentCheck, { ok: false }>["reason"] | "limit_files" | "limit_bytes" | "not_found" | "not_uploaded" | "storage";

export class AttachmentError extends Error {
  constructor(public reason: AttachmentErrorReason) {
    super(`attachment: ${reason}`);
    this.name = "AttachmentError";
  }
}

async function sessionUsage(sessionId: string): Promise<{ count: number; bytes: number }> {
  const { data } = await db().from("lab_attachments").select("size_bytes").eq("session_id", sessionId);
  const rows = (data ?? []) as Array<{ size_bytes: number }>;
  return { count: rows.length, bytes: rows.reduce((s, r) => s + Number(r.size_bytes || 0), 0) };
}

/** Step 1: validate, reserve a row, return a signed upload URL (valid ~2 h). */
export async function createAttachmentUpload(sessionId: string, file: { name: string; mime: string; size: number }): Promise<{ attachment: LabAttachmentRow; uploadUrl: string }> {
  const check = checkAttachment(file);
  if (!check.ok) throw new AttachmentError(check.reason);
  const usage = await sessionUsage(sessionId);
  if (usage.count >= ATTACHMENT_LIMITS.maxFilesPerSession) throw new AttachmentError("limit_files");
  if (usage.bytes + file.size > ATTACHMENT_LIMITS.maxBytesPerSession) throw new AttachmentError("limit_bytes");

  const id = randomUUID();
  const path = `${sessionId}/${id}/${storageName(file.name)}`;
  const { data: signed, error: signErr } = await db().storage.from(ATTACHMENT_BUCKET).createSignedUploadUrl(path);
  if (signErr || !signed) throw new AttachmentError("storage");
  const { data, error } = await db()
    .from("lab_attachments")
    .insert({ id, session_id: sessionId, kind: "file", file_name: file.name.trim().slice(0, 255), mime_type: (file.mime || "application/octet-stream").slice(0, 200), size_bytes: file.size, storage_path: path, status: "pending" })
    .select("*")
    .single();
  if (error || !data) throw new AttachmentError("storage");
  return { attachment: data as LabAttachmentRow, uploadUrl: signed.signedUrl };
}

/** Step 2: the browser says the upload finished; verify the object is really there. */
export async function confirmAttachmentUpload(sessionId: string, attachmentId: string): Promise<LabAttachmentRow> {
  const { data: row } = await db().from("lab_attachments").select("*").eq("id", attachmentId).eq("session_id", sessionId).maybeSingle();
  if (!row) throw new AttachmentError("not_found");
  const att = row as LabAttachmentRow;
  if (att.status === "stored") return att;
  const folder = att.storage_path.split("/").slice(0, -1).join("/");
  const objectName = att.storage_path.split("/").pop() as string;
  const { data: listed, error } = await db().storage.from(ATTACHMENT_BUCKET).list(folder, { search: objectName, limit: 5 });
  const obj = (listed ?? []).find((o) => o.name === objectName);
  if (error || !obj) throw new AttachmentError("not_uploaded");
  const size = Number((obj.metadata as { size?: number } | null)?.size ?? att.size_bytes);
  const { data: updated } = await db()
    .from("lab_attachments")
    .update({ status: "stored", stored_at: new Date().toISOString(), size_bytes: size })
    .eq("id", att.id)
    .select("*")
    .single();
  return (updated ?? att) as LabAttachmentRow;
}

/** Store bytes that already reached the server (voice recordings). */
export async function storeServerAttachment(sessionId: string, file: { name: string; mime: string; bytes: Buffer; kind: "file" | "voice" }): Promise<LabAttachmentRow | null> {
  const id = randomUUID();
  const path = `${sessionId}/${id}/${storageName(file.name)}`;
  const { error: upErr } = await db().storage.from(ATTACHMENT_BUCKET).upload(path, file.bytes, { contentType: file.mime, upsert: false });
  if (upErr) return null;
  const { data } = await db()
    .from("lab_attachments")
    .insert({ id, session_id: sessionId, kind: file.kind, file_name: file.name, mime_type: file.mime, size_bytes: file.bytes.length, storage_path: path, status: "stored", stored_at: new Date().toISOString() })
    .select("*")
    .single();
  return (data ?? null) as LabAttachmentRow | null;
}

/** Stored attachments of this session that are not yet tied to a message. */
export async function getUnlinkedAttachments(sessionId: string, ids: string[]): Promise<LabAttachmentRow[]> {
  if (!ids.length) return [];
  const { data } = await db().from("lab_attachments").select("*").eq("session_id", sessionId).in("id", ids.slice(0, ATTACHMENT_LIMITS.maxFilesPerMessage)).is("message_id", null).eq("status", "stored");
  return (data ?? []) as LabAttachmentRow[];
}

export async function linkAttachmentsToMessage(sessionId: string, ids: string[], messageId: string): Promise<void> {
  if (!ids.length) return;
  await db().from("lab_attachments").update({ message_id: messageId }).eq("session_id", sessionId).in("id", ids).is("message_id", null);
}

export async function listAttachments(sessionId: string): Promise<LabAttachmentRow[]> {
  const { data } = await db().from("lab_attachments").select("*").eq("session_id", sessionId).order("created_at", { ascending: true });
  return (data ?? []) as LabAttachmentRow[];
}

/** Owner-only: short-lived download links that keep the original file name. */
export async function signedDownloads(rows: LabAttachmentRow[], ttlSeconds = 3600): Promise<Array<LabAttachmentRow & { url: string | null }>> {
  return Promise.all(
    rows.map(async (r) => {
      if (r.status !== "stored") return { ...r, url: null };
      const { data } = await db().storage.from(ATTACHMENT_BUCKET).createSignedUrl(r.storage_path, ttlSeconds, { download: r.file_name });
      return { ...r, url: data?.signedUrl ?? null };
    }),
  );
}

/**
 * Remove the stored bytes of these sessions. Rows cascade with the session;
 * storage objects do not, so every deletion path calls this FIRST.
 */
export async function removeAttachmentObjects(sessionIds: string[]): Promise<number> {
  if (!sessionIds.length) return 0;
  const { data } = await db().from("lab_attachments").select("storage_path").in("session_id", sessionIds);
  const paths = ((data ?? []) as Array<{ storage_path: string }>).map((r) => r.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    await db().storage.from(ATTACHMENT_BUCKET).remove(paths.slice(i, i + 100));
  }
  return paths.length;
}
