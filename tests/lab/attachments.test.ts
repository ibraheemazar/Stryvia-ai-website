import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ATTACHMENT_LIMITS, attachmentLine, checkAttachment, extensionOf, humanSize, storageName } from "@/lib/lab/attachment-policy";

// Every file a visitor sends is kept (owner requirement). These tests pin the
// policy (what is accepted), the storage naming, and the structural rule that
// no deletion path forgets the stored bytes.

const root = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("attachment policy", () => {
  it("accepts documents, images, spreadsheets, slides, audio, video and archives", () => {
    for (const [name, mime] of [
      ["brochure.pdf", "application/pdf"],
      ["عرض الشركة.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      ["bookings.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["photo.HEIC", "image/heic"],
      ["walkthrough.mov", "video/quicktime"],
      ["voice.m4a", "audio/mp4"],
      ["history.zip", "application/zip"],
      ["notes", ""],
    ]) {
      expect(checkAttachment({ name, mime, size: 1024 }), name).toEqual({ ok: true });
    }
  });

  it("refuses executables and scripts, empty files and files above the limit", () => {
    expect(checkAttachment({ name: "setup.exe", mime: "application/octet-stream", size: 10 })).toEqual({ ok: false, reason: "blocked_type" });
    expect(checkAttachment({ name: "run.sh", mime: "text/plain", size: 10 })).toEqual({ ok: false, reason: "blocked_type" });
    expect(checkAttachment({ name: "x.bin", mime: "application/x-msdownload", size: 10 })).toEqual({ ok: false, reason: "blocked_type" });
    expect(checkAttachment({ name: "a.pdf", mime: "application/pdf", size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(checkAttachment({ name: "a.pdf", mime: "application/pdf", size: ATTACHMENT_LIMITS.maxBytes + 1 })).toEqual({ ok: false, reason: "too_large" });
    expect(checkAttachment({ name: " ", mime: "", size: 10 })).toEqual({ ok: false, reason: "bad_name" });
  });

  it("names objects safely while the row keeps the original name", () => {
    expect(storageName("Q3 plan (final).PDF")).toBe("Q3_plan_final.pdf");
    expect(storageName("../../etc/passwd")).not.toContain("/");
    expect(storageName("عرض الشركة.pptx")).toBe("file.pptx");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
  });

  it("records the files in the transcript line, in the conversation language", () => {
    expect(attachmentLine([{ name: "brochure.pdf", size: 2_500_000 }], "en")).toBe("📎 Attached: brochure.pdf (2.4 MB)");
    expect(attachmentLine([{ name: "a.png", size: 2048 }, { name: "b.xlsx", size: 900 }], "ar")).toBe("📎 مرفقات: a.png (2 KB), b.xlsx (900 B)");
    expect(attachmentLine([], "en")).toBe("");
    expect(humanSize(0)).toBe("0 B");
  });
});

describe("attachment storage invariants", () => {
  it("every deletion path removes stored files before the rows go", () => {
    for (const [file, marker] of [
      ["src/lib/lab/store.ts", "export async function deleteVisitorData"],
      ["src/lib/lab/admin.ts", "export async function adminDeleteSession"],
      ["src/lib/lab/cron.ts", "export async function labRetention"],
    ] as const) {
      const src = read(file);
      const fn = src.slice(src.indexOf(marker));
      const remove = fn.indexOf("removeAttachmentObjects(");
      const del = fn.search(/from\("lab_(sessions|visitors)"\)\s*\.delete\(\)|\.from\("lab_(sessions|visitors)"\)\.delete\(\)/);
      expect(remove, file).toBeGreaterThan(-1);
      expect(remove, file).toBeLessThan(del);
    }
  });

  it("the bucket is private, the table has RLS, and the migration ships a down file", () => {
    const up = read("supabase/migrations/0009_lab_attachments.sql");
    expect(up).toMatch(/'lab-attachments', 'lab-attachments', false/);
    expect(up).toMatch(/alter table public\.lab_attachments enable row level security/);
    expect(up).not.toMatch(/create policy/i);
    expect(read("supabase/migrations/down/0009_lab_attachments.down.sql")).toMatch(/drop table if exists public\.lab_attachments/);
  });

  it("visitors never receive a storage path or a download link", () => {
    for (const f of ["src/app/api/lab/session/[id]/attachments/route.ts", "src/app/api/lab/session/[id]/attachments/[attachmentId]/route.ts", "src/app/api/lab/session/[id]/route.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/storage_path|signedDownloads|createSignedUrl/);
    }
    // Only the admin detail builds download links.
    expect(read("src/lib/lab/admin.ts")).toMatch(/signedDownloads\(/);
  });

  it("voice recordings that reach the server are kept even when transcription fails", () => {
    const src = read("src/app/api/lab/session/[id]/transcribe/route.ts");
    expect(src.indexOf("storeServerAttachment(")).toBeGreaterThan(-1);
    expect(src.indexOf("storeServerAttachment(")).toBeLessThan(src.indexOf("provider.transcribe("));
  });

  it("the turn records attached files from stored rows, not from client text", () => {
    const engine = read("src/lib/lab/engine.ts");
    expect(engine).toMatch(/getUnlinkedAttachments\(session\.id, input\.attachmentIds/);
    expect(engine).toMatch(/linkAttachmentsToMessage\(session\.id/);
  });
});
