import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { clearImpersonationCookie } from "@/lib/admin/impersonate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApi("operator");
  if (auth.error) return auth.error;

  await clearImpersonationCookie();

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "stop_impersonation",
    targetType: "admin",
    targetId: "impersonation",
  });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  return NextResponse.json({ ok: true });
}
