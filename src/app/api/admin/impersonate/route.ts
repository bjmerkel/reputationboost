import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { setImpersonationCookie } from "@/lib/admin/impersonate";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApi("operator");
  if (auth.error) return auth.error;

  const contentType = request.headers.get("content-type") ?? "";
  let userId: string | null = null;
  let businessId: string | null = null;

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { userId?: string; businessId?: string };
    userId = body.userId ?? null;
    businessId = body.businessId ?? null;
  } else {
    const form = await request.formData();
    userId = form.get("userId")?.toString() ?? null;
    businessId = form.get("businessId")?.toString() || null;
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (businessId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id, user_id")
      .eq("id", businessId)
      .maybeSingle();

    if (!business || business.user_id !== userId) {
      return NextResponse.json({ error: "Business not found for user" }, { status: 404 });
    }
  }

  await setImpersonationCookie({
    adminUserId: auth.user.id,
    userId,
    businessId,
  });

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "start_manage_as_user",
    targetType: "user",
    targetId: userId,
    metadata: { businessId },
  });

  const redirectUrl = businessId
    ? `/platform/audit?businessId=${encodeURIComponent(businessId)}`
    : "/platform/audit";

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL(redirectUrl, request.url), 303);
  }

  return NextResponse.json({ ok: true, redirectUrl });
}
