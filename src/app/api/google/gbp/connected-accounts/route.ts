import { NextResponse } from "next/server";
import { listUserBusinesses } from "@/audit/businesses";
import { listGbpTokenSources } from "@/lib/google/gbp-import";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await listUserBusinesses(user.id);
  const accounts = listGbpTokenSources(rows);

  return NextResponse.json({ accounts });
}
