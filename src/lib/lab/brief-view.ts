import "server-only";
import { versionStatuses, type BriefVersionInfo } from "./brief-diff";
import { normalizeBrief } from "./schemas";
import { listBriefVersions, type LabBriefRow, type LabSessionRow } from "./store";

// Visitor-facing shape of a brief version. Never carries anything but the
// brief itself and its lineage.

export function briefView(row: LabBriefRow, session: Pick<LabSessionRow, "current_brief_version" | "submitted_brief_version">) {
  const [info] = versionStatuses([row], { current: session.current_brief_version, submitted: session.submitted_brief_version });
  return {
    version: row.version,
    language: row.language,
    content: normalizeBrief(row.content),
    visitorEdited: row.visitor_edited,
    kind: row.kind,
    sourceVersion: row.source_version,
    status: info.status,
    createdAt: row.created_at,
  };
}

export async function briefVersionsView(session: Pick<LabSessionRow, "id" | "current_brief_version" | "submitted_brief_version">): Promise<BriefVersionInfo[]> {
  const rows = await listBriefVersions(session.id);
  return versionStatuses(rows, { current: session.current_brief_version, submitted: session.submitted_brief_version });
}
