import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi("viewer");
  if (auth.error) return auth.error;

  const overview = await getAdminOverview();

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "view_overview",
    targetType: "admin",
    targetId: "overview",
  });

  return NextResponse.json(overview);
}
