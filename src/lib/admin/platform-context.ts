import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationState } from "@/lib/admin/impersonate";
import { getUser } from "@/lib/supabase/server";

export interface PlatformViewerContext {
  sessionUserId: string;
  sessionEmail: string | null;
  viewerUserId: string;
  viewerEmail: string | null;
  viewerName: string | null;
  isImpersonating: boolean;
  impersonationBusinessId: string | null;
}

export async function getPlatformViewerContext(): Promise<PlatformViewerContext | null> {
  const sessionUser = await getUser();
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
    };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", impersonation.userId)
    .maybeSingle();

  return {
    sessionUserId: sessionUser.id,
    sessionEmail: sessionUser.email ?? null,
    viewerUserId: impersonation.userId,
    viewerEmail: profile?.email ?? null,
    viewerName: profile?.full_name ?? null,
    isImpersonating: true,
    impersonationBusinessId: impersonation.businessId,
  };
}
