import { cookies } from "next/headers";
import { getAdminRole } from "@/lib/admin/auth-role";

export const IMPERSONATE_COOKIE = "rb_admin_impersonate";

export interface ImpersonationState {
  adminUserId: string;
  userId: string;
  businessId: string | null;
}

function parseImpersonationCookie(raw: string | undefined): ImpersonationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ImpersonationState;
    if (!parsed.adminUserId || !parsed.userId) return null;
    return {
      adminUserId: parsed.adminUserId,
      userId: parsed.userId,
      businessId: parsed.businessId ?? null,
    };
  } catch {
    return null;
  }
}

export async function getImpersonationState(sessionUserId: string): Promise<ImpersonationState | null> {
  const cookieStore = await cookies();
  const parsed = parseImpersonationCookie(cookieStore.get(IMPERSONATE_COOKIE)?.value);
  if (!parsed || parsed.adminUserId !== sessionUserId) return null;

  const role = await getAdminRole(sessionUserId);
  if (!role) return null;

  return parsed;
}

export async function setImpersonationCookie(state: ImpersonationState): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
}

export async function clearImpersonationCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
}

export function readImpersonationFromRequest(
  sessionUserId: string,
  cookieValue: string | undefined
): ImpersonationState | null {
  const parsed = parseImpersonationCookie(cookieValue);
  if (!parsed || parsed.adminUserId !== sessionUserId) return null;
  return parsed;
}
