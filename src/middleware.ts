import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/platform/:path*",
    "/api/audit/:path*",
    "/api/execution/:path*",
    "/api/places/:path*",
    "/api/business",
    "/api/keywords/:path*",
    "/api/google/gbp/connect",
    "/api/google/gbp/disconnect",
    "/api/google/gbp/select-location",
    "/login",
  ],
};
