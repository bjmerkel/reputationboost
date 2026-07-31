import { NextResponse } from "next/server";
import { logAdminAction, requireGodModeApi } from "@/lib/admin/auth";
import { addAdminTeamMember, listAdminTeamMembers } from "@/lib/admin/team";
import type { AdminRole } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireGodModeApi();
  if (auth.error) return auth.error;

  const members = await listAdminTeamMembers();
  return NextResponse.json({ members });
}

export async function POST(request: Request) {
  const auth = await requireGodModeApi();
  if (auth.error) return auth.error;

  const body = (await request.json()) as { email?: string; role?: AdminRole };
  const email = body.email?.trim();
  const role = body.role;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (role !== "viewer" && role !== "operator") {
    return NextResponse.json({ error: "Role must be viewer or operator" }, { status: 400 });
  }

  try {
    const member = await addAdminTeamMember({
      email,
      role,
      grantedBy: auth.user.id,
    });

    await logAdminAction({
      adminUserId: auth.user.id,
      action: "add_admin_team_member",
      targetType: "user",
      targetId: member.userId ?? undefined,
      metadata: { email: member.email, role: member.role },
    });

    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add team member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
