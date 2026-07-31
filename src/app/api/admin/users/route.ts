import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { listAdminUsers } from "@/lib/admin/users";
import type { HealthGrade } from "@/audit/types";
import type { UserStatus } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApi("viewer");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const grade = (searchParams.get("grade") ?? "all") as HealthGrade | "all";
  const status = (searchParams.get("status") ?? "all") as UserStatus | "all";
  const page = Number(searchParams.get("page") ?? "1");

  const result = await listAdminUsers({ q, grade, status, page });

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "list_users",
    targetType: "admin",
    targetId: "users",
    metadata: { q, grade, status, page },
  });

  return NextResponse.json(result);
}
