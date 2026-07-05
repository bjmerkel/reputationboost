import { NextResponse } from "next/server";
import { computeGridDiff } from "@/audit/geo/grid-diff";
import {
  loadGridForDateForUser,
  listGridSnapshotDatesForUser,
} from "@/audit/storage-grid-snapshots";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const keyword = searchParams.get("keyword");
  const before = searchParams.get("before");
  const after = searchParams.get("after");

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  const business = await getPrimaryBusiness(user.id);
  const center =
    business?.location.lat && business?.location.lng
      ? { lat: business.location.lat, lng: business.location.lng }
      : undefined;

  let beforeDate = before;
  let afterDate = after;

  if (!beforeDate || !afterDate) {
    const snapshots = await listGridSnapshotDatesForUser(user.id, clientId, keyword, 12);
    if (snapshots.length < 2) {
      return NextResponse.json({
        error: "Need at least two grid snapshots to compute a diff",
        snapshots,
      }, { status: 400 });
    }
    afterDate = afterDate ?? snapshots[0]!.date;
    beforeDate = beforeDate ?? snapshots[1]!.date;
  }

  const [beforeGrid, afterGrid] = await Promise.all([
    loadGridForDateForUser(user.id, clientId, keyword, beforeDate!, center),
    loadGridForDateForUser(user.id, clientId, keyword, afterDate!, center),
  ]);

  if (beforeGrid.length === 0 || afterGrid.length === 0) {
    return NextResponse.json(
      { error: "Grid data not found for one or both dates", beforeDate, afterDate },
      { status: 404 }
    );
  }

  const diff = computeGridDiff(beforeGrid, afterGrid, keyword, beforeDate!, afterDate!);
  return NextResponse.json({ diff, beforeDate, afterDate });
}
