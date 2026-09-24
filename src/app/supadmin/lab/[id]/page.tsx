"use client";

import { useParams } from "next/navigation";
import { LabAdminGate } from "../LabAdminGate";
import { LabDetail } from "../LabDetail";

export default function LabAdminDetailPage() {
  const params = useParams<{ id: string }>();
  return <LabAdminGate title="Submission">{(token) => <LabDetail token={token} id={params.id} />}</LabAdminGate>;
}
