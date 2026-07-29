import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/business/active-business-shared";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const businessId = request.nextUrl.searchParams.get("businessId");

  if (businessId && request.nextUrl.pathname.startsWith("/platform")) {
    response.cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/platform/:path*",
    "/api/audit/:path*",
    "/api/execution/:path*",
    "/api/places/:path*",
    "/api/business",
    "/api/customers",
    "/api/customers/activity",
    "/api/customers/import",
    "/api/review-requests/generate",
    "/api/review-requests/send",
    "/api/integrations/settings",
    "/api/keywords/:path*",
    "/api/google/gbp/connect",
    "/api/google/gbp/disconnect",
    "/api/google/gbp/apply",
    "/api/google/gbp/media",
    "/api/google/gbp/media/batch",
    "/api/google/gbp/media/generate",
    "/api/google/gbp/notifications",
    "/api/google/gbp/performance",
    "/api/google/gbp/select-location",
    "/login",
    "/login/forgot-password",
    "/login/reset-password",
  ],
};
