import { canManageOnBehalf, getAdminRole } from "@/lib/admin/auth-role";
import { getImpersonationState } from "@/lib/admin/impersonate";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActingUser, getSessionUser } from "@/lib/supabase/server";

export interface PlatformViewerContext {
  sessionUserId: string;
  sessionEmail: string | null;
  viewerUserId: string;
  viewerEmail: string | null;
  viewerName: string | null;
  isImpersonating: boolean;
  impersonationBusinessId: string | null;
  canManageOnBehalf: boolean;
}

export async function getPlatformViewerContext(): Promise<PlatformViewerContext | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const impersonation = await getImpersonationState(sessionUser.id);
  if (!impersonation) {
    return {
      sessionUserId: sessionUser.id,
      sessionEmail: sessionUser.email ?? null,
      viewerUserId: sessionUser.id,
      viewerEmail: sessionUser.email ?? null,
      viewerName: null,
      isImpersonating: false,
      impersonationBusinessId: null,
      canManageOnBehalf: false,
    };
  }

  const actingUser = await getActingUser();
  const role = await getAdminRole(sessionUser.id, sessionUser.email);
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", impersonation.userId)
    .maybeSingle();

  return {
    sessionUserId: sessionUser.id,
    sessionEmail: sessionUser.email ?? null,
    viewerUserId: actingUser?.id ?? impersonation.userId,
    viewerEmail: profile?.email ?? actingUser?.email ?? null,
    viewerName: profile?.full_name ?? null,
    isImpersonating: true,
    impersonationBusinessId: impersonation.businessId,
    canManageOnBehalf: canManageOnBehalf(role),
  };
}
