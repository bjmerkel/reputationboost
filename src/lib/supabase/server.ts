import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { canManageOnBehalf, getAdminRole } from "@/lib/admin/auth-role";
import { getImpersonationState } from "@/lib/admin/impersonate";
import { createAdminClient } from "@/lib/supabase/admin";

async function createSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // handles session refresh.
        }
      },
    },
  });
}

async function resolveActingUser(sessionUser: User): Promise<User> {
  const impersonation = await getImpersonationState(sessionUser.id);
  if (!impersonation) return sessionUser;

  const role = await getAdminRole(sessionUser.id, sessionUser.email);
  if (!role) return sessionUser;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", impersonation.userId)
    .maybeSingle();

  return {
    ...sessionUser,
    id: impersonation.userId,
    email: profile?.email ?? sessionUser.email,
    user_metadata: {
      ...sessionUser.user_metadata,
      full_name: profile?.full_name ?? sessionUser.user_metadata?.full_name,
    },
  };
}

export async function createClient() {
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    const impersonation = await getImpersonationState(sessionUser.id);
    if (impersonation) {
      const role = await getAdminRole(sessionUser.id, sessionUser.email);
      if (role) {
        return createAdminClient();
      }
    }
  }

  return createSessionClient();
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function getActingUser(): Promise<User | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;
  return resolveActingUser(sessionUser);
}

/** Effective user for platform/API data access (impersonated user when managing on behalf). */
export async function getUser() {
  return getActingUser();
}

export async function canManageOnBehalfOfUser(): Promise<boolean> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return false;

  const impersonation = await getImpersonationState(sessionUser.id);
  if (!impersonation) return false;

  const role = await getAdminRole(sessionUser.id, sessionUser.email);
  return canManageOnBehalf(role);
}
