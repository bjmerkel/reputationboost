import { NextResponse } from "next/server";
import { listAuditsFromSupabase } from "@/audit/storage-supabase";
import { isLocalStorageAvailable } from "@/audit/storage-env";
import { listAudits } from "@/audit/storage";
import { getUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  try {
    const fromDb = await listAuditsFromSupabase(user.id, clientId);
    const audits =
      fromDb.length > 0
        ? fromDb
        : isLocalStorageAvailable()
          ? await listAudits(clientId)
          : [];
    return NextResponse.json({ clientId, audits });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list audits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
