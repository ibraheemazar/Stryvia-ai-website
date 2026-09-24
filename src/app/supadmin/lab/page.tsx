"use client";

import { LabAdminGate } from "./LabAdminGate";
import { LabList } from "./LabList";

export default function LabAdminPage() {
  return <LabAdminGate title="Submissions">{(token) => <LabList token={token} />}</LabAdminGate>;
}
