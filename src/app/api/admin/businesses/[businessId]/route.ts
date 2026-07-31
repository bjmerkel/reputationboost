import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { getAdminBusinessDetail } from "@/lib/admin/businesses";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ businessId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi("viewer");
  if (auth.error) return auth.error;

  const { businessId } = await context.params;
  const business = await getAdminBusinessDetail(businessId);

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "view_business",
    targetType: "business",
    targetId: businessId,
  });

  return NextResponse.json(business);
}
