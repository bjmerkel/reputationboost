import { NextResponse } from "next/server";
import { getBusinessRecord } from "@/audit/businesses";
import { formatBusinessAddress, listImportCandidates } from "@/lib/google/gbp-import";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceBusinessId = searchParams.get("sourceBusinessId");
  const targetBusinessId = searchParams.get("targetBusinessId");

  if (!sourceBusinessId) {
    return NextResponse.json({ error: "sourceBusinessId is required" }, { status: 400 });
  }

  try {
    let targetBusiness;
    if (targetBusinessId) {
      const target = await getBusinessRecord(user.id, targetBusinessId);
      if (!target) {
        return NextResponse.json({ error: "Target business not found" }, { status: 404 });
      }
      targetBusiness = {
        businessId: target.id,
        name: target.name,
        placeId: target.gbp_place_id,
        address: formatBusinessAddress(target),
      };
    }

    const result = await listImportCandidates(user.id, sourceBusinessId, targetBusiness);

    return NextResponse.json({
      sourceBusinessId,
      googleEmail: result.googleEmail,
      locations: result.locations,
      totalCount: result.totalCount,
      unlinkedCount: result.unlinkedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load import candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
