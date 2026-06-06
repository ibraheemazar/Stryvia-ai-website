// Example CRM data route. Copy to `app/api/admin/crm/data/route.ts`.
import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../src/auth/verify";
import { getCrmData } from "../src/modules/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const url = new URL(req.url);
  const data = await getCrmData({
    view: url.searchParams.get("view") ?? "inbox",
    q: url.searchParams.get("q"),
    status: url.searchParams.get("status"),
  });
  return NextResponse.json(data);
}
