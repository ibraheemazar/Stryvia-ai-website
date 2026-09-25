import type { Brief } from "./schemas";

// Pure helpers for brief versions: field-level diff between two briefs (shown
// to the visitor before they accept an AI revision or translation) and the
// status of each saved version relative to the session pointers. No server
// imports so unit tests and the client-side types can share them.

export type BriefKind = "generated" | "edited" | "translated" | "revised";

export type BriefChange = { path: string; before: string; after: string };

/** Flatten a brief into dot-paths → string (arrays joined by newlines). */
export function flattenBrief(b: Brief): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (v: unknown, prefix: string) => {
    if (Array.isArray(v)) out[prefix] = v.map(String).join("\n");
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, prefix ? `${prefix}.${k}` : k);
    else out[prefix] = String(v ?? "");
  };
  walk(b, "");
  return out;
}

/** Fields whose text differs between two briefs, in document order. */
export function diffBrief(before: Brief, after: Brief): BriefChange[] {
  const a = flattenBrief(before);
  const b = flattenBrief(after);
  const changes: BriefChange[] = [];
  for (const path of Object.keys(b)) {
    if ((a[path] ?? "") !== (b[path] ?? "")) changes.push({ path, before: a[path] ?? "", after: b[path] });
  }
  return changes;
}

export type BriefVersionStatus = "current" | "submitted" | "proposed" | "superseded";

export type BriefVersionInfo = {
  version: number;
  language: "en" | "ar";
  kind: BriefKind;
  sourceVersion: number | null;
  createdAt: string;
  status: BriefVersionStatus;
};

/**
 * Status of every version given the session pointers. A proposal is a
 * translation or AI revision made from the CURRENT version that the visitor
 * has not accepted yet; once the current version moves on it is superseded and
 * can no longer be accepted (it would overwrite newer edits).
 */
export function versionStatuses(
  rows: Array<{ version: number; language: "en" | "ar"; kind: BriefKind; source_version: number | null; created_at: string }>,
  pointers: { current: number | null; submitted: number | null },
): BriefVersionInfo[] {
  return rows
    .slice()
    .sort((x, y) => x.version - y.version)
    .map((r) => {
      let status: BriefVersionStatus = "superseded";
      if (pointers.submitted != null && r.version === pointers.submitted) status = "submitted";
      else if (r.version === pointers.current) status = "current";
      else if ((r.kind === "translated" || r.kind === "revised") && r.source_version === pointers.current && pointers.submitted == null) status = "proposed";
      return { version: r.version, language: r.language, kind: r.kind, sourceVersion: r.source_version, createdAt: r.created_at, status };
    });
}
