import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { getAdminUserDetail } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi("viewer");
  if (auth.error) return auth.error;

  const { userId } = await context.params;
  const user = await getAdminUserDetail(userId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "view_user",
    targetType: "user",
    targetId: userId,
  });

  return NextResponse.json(user);
}
