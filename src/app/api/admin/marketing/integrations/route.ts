import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, requireService } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Connect / disconnect / configure an integration. Credentials themselves live
// in environment secrets; this records connection state and non-secret config.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.provider) return NextResponse.json({ ok: false }, { status: 400 });

  const status = ["connected", "disconnected", "error"].includes(body.status)
    ? body.status
    : "disconnected";

  const svc = requireService();
  const { error } = await svc
    .from("marketing_integrations")
    .update({
      status,
      config: body.config || {},
      connected_at: status === "connected" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", body.provider);

  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
