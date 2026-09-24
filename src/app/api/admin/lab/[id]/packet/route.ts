import { NextResponse, type NextRequest } from "next/server";
import { getSessionDetail } from "@/lib/lab/admin";
import { adminJson, withAdminLabRoute } from "@/lib/lab/admin-http";
import { packetHtml, packetMarkdown } from "@/lib/lab/packet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Review packet export (brief §8): ?format=md (download) | html (print → PDF).
export const GET = withAdminLabRoute<{ id: string }>("admin.lab.packet", async (req: NextRequest, { params }) => {
  const detail = await getSessionDetail(params.id);
  if (!detail) return adminJson({ ok: false, error: "not_found" }, 404);
  const format = req.nextUrl.searchParams.get("format") ?? "md";
  const slug = detail.session.visitor_name.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "-").slice(0, 40) || "packet";
  if (format === "html") {
    return new NextResponse(packetHtml(detail), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  return new NextResponse(packetMarkdown(detail), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="idea-lab-${slug}-${detail.session.id.slice(0, 8)}.md"`,
      "Cache-Control": "no-store",
    },
  });
});
