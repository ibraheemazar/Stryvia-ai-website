// What a visitor may attach, and how it is named in storage. Pure; unit-tested.
//
// The owner wants every file a visitor sends, so the policy is permissive by
// type (documents, images, spreadsheets, slides, audio, video, archives) and
// refuses only executables and scripts, which could harm whoever opens them.

export const ATTACHMENT_LIMITS = {
  /** Per file. Matches the bucket's `file_size_limit` (0009 migration). */
  maxBytes: 50 * 1024 * 1024,
  /** Per session, to bound abuse; generous for real use. */
  maxFilesPerSession: 40,
  maxBytesPerSession: 500 * 1024 * 1024,
  /** Files per visitor message. */
  maxFilesPerMessage: 10,
} as const;

const BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "dll", "sys", "vbs", "vbe", "js", "jse", "mjs", "cjs", "ws", "wsf", "wsh",
  "ps1", "psm1", "sh", "bash", "zsh", "command", "app", "dmg", "pkg", "deb", "rpm", "apk", "ipa", "jar", "hta", "lnk", "reg", "iso", "img",
]);

const BLOCKED_MIME = /^(application\/(x-msdownload|x-msdos-program|x-sh|x-executable|x-mach-binary|java-archive|vnd\.microsoft\.portable-executable|x-apple-diskimage)|text\/javascript|application\/javascript)$/i;

export function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export type AttachmentCheck = { ok: true } | { ok: false; reason: "blocked_type" | "too_large" | "empty" | "bad_name" };

export function checkAttachment(input: { name: string; mime: string; size: number }): AttachmentCheck {
  const name = input.name.trim();
  if (!name || name.length > 255) return { ok: false, reason: "bad_name" };
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false, reason: "empty" };
  if (input.size > ATTACHMENT_LIMITS.maxBytes) return { ok: false, reason: "too_large" };
  if (BLOCKED_EXTENSIONS.has(extensionOf(name)) || BLOCKED_MIME.test(input.mime.trim())) return { ok: false, reason: "blocked_type" };
  return { ok: true };
}

/**
 * A storage-safe object name that keeps the original name recognisable.
 * Arabic and other letters survive; path separators, control characters and
 * characters storage keys reject are replaced. The original name is kept
 * verbatim in the database row.
 */
export function storageName(name: string): string {
  const ext = extensionOf(name);
  const base = name
    .trim()
    .replace(/\.[A-Za-z0-9]{1,10}$/, "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\?#%*:|"<>{}[\]^`~]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80)
    .replace(/^[._]+|[._]+$/g, "");
  // Storage keys are safest in ASCII; keep a readable ASCII fallback.
  const ascii = base.replace(/[^A-Za-z0-9._-]/g, "").replace(/_+/g, "_").replace(/^[._-]+|[._-]+$/g, "");
  const safe = ascii || "file";
  return ext ? `${safe}.${ext}` : safe;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The line added to the visitor's message so the transcript records what was sent. */
export function attachmentLine(files: Array<{ name: string; size: number }>, language: "en" | "ar"): string {
  if (!files.length) return "";
  const list = files.map((f) => `${f.name} (${humanSize(f.size)})`).join(", ");
  return language === "ar" ? `📎 مرفقات: ${list}` : `📎 Attached: ${list}`;
}
