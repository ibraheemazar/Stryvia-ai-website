import { NextResponse, type NextRequest } from "next/server";
import { LAB_ADMIN_PATH } from "@/config/lab.config";

// The brief names /admin/lab; the site's real admin lives at /supadmin.
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL(LAB_ADMIN_PATH, req.nextUrl.origin), 308);
}
