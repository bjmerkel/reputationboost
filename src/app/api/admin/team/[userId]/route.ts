import { NextResponse } from "next/server";
import { logAdminAction, requireGodModeApi } from "@/lib/admin/auth";
import { removeAdminTeamMember, updateAdminTeamMemberRole } from "@/lib/admin/team";
import type { AdminRole } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireGodModeApi();
  if (auth.error) return auth.error;

  const { userId } = await context.params;
  const body = (await request.json()) as { role?: AdminRole };
  if (body.role !== "viewer" && body.role !== "operator") {
    return NextResponse.json({ error: "Role must be viewer or operator" }, { status: 400 });
  }

  try {
    await updateAdminTeamMemberRole({ userId, role: body.role });

    await logAdminAction({
      adminUserId: auth.user.id,
      action: "update_admin_team_member",
      targetType: "user",
      targetId: userId,
      metadata: { role: body.role },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update team member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireGodModeApi();
  if (auth.error) return auth.error;

  const { userId } = await context.params;

  try {
    await removeAdminTeamMember(userId);

    await logAdminAction({
      adminUserId: auth.user.id,
      action: "remove_admin_team_member",
      targetType: "user",
      targetId: userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove team member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
