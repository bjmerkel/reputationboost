import { NextResponse } from "next/server";
import { loadBusinessConfig } from "@/audit/businesses";
import {
  buildClientProfileSnapshot,
  computeLeaderDelta,
} from "@/audit/autopilot/leader-delta-engine";
import { buildCompetitorProfileIndex, resolveCompetitorProfile } from "@/audit/autopilot/competitor-profile-index";
import { deriveMarketKey } from "@/audit/autopilot/market-key";
import {
  activateSuggestedExperiment,
  proposeExperimentFromDelta,
} from "@/audit/autopilot/plan-experiments";
import {
  dismissSuggestedExperimentAdmin,
  listRankingExperimentsForUser,
} from "@/audit/storage-experiments";
import { loadMarketCalibrationForMarketKey } from "@/audit/storage-calibration-market";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const businessId = await getBusinessIdForSlug(user.id, clientId);
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const experiments = await listRankingExperimentsForUser(user.id, businessId);
  return NextResponse.json({ experiments });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    keyword?: string;
    gridNorth?: number;
    gridEast?: number;
    actionIndex?: number;
  };

  if (!body.clientId || !body.keyword || body.gridNorth == null || body.gridEast == null) {
    return NextResponse.json(
      { error: "clientId, keyword, gridNorth, and gridEast are required" },
      { status: 400 }
    );
  }

  const audit = await loadLatestAuditFromSupabase(user.id, body.clientId);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const snapshot = audit.rankings.keywords.find(
    (row) => row.keyword.toLowerCase() === body.keyword!.toLowerCase()
  );
  const cell = snapshot?.geoGrid?.find(
    (point) =>
      point.offsetNorthMiles === body.gridNorth &&
      point.offsetEastMiles === body.gridEast
  );
  if (!cell) {
    return NextResponse.json({ error: "Grid cell not found" }, { status: 404 });
  }

  const index = buildCompetitorProfileIndex(audit.competitors);
  const marketKey = deriveMarketKey(audit);
  const marketIndex = await loadMarketCalibrationForMarketKey(marketKey);
  const leaderPlaceId = cell.localPack?.[0]?.placeId;
  const leaderProfile = leaderPlaceId
    ? resolveCompetitorProfile(index, body.keyword, leaderPlaceId)
    : null;

  const delta = computeLeaderDelta({
    keyword: body.keyword,
    cell,
    client: buildClientProfileSnapshot(audit.gbp),
    leaderProfile,
    marketKey,
    marketIndex,
  });
  if (!delta || delta.rankedActions.length === 0) {
    return NextResponse.json(
      { error: "No actionable experiment hypothesis for this cell" },
      { status: 400 }
    );
  }

  const client = await loadBusinessConfig(user.id, body.clientId);
  const businessId = client.businessId ?? (await getBusinessIdForSlug(user.id, body.clientId));
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    const result = await proposeExperimentFromDelta({
      audit,
      delta,
      userId: user.id,
      businessId,
      client,
      origin: "manual",
      actionIndex: body.actionIndex,
      marketIndex,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to propose experiment" },
      { status: 409 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    experimentId?: string;
    action?: "activate" | "dismiss";
  };

  if (!body.clientId || !body.experimentId || !body.action) {
    return NextResponse.json(
      { error: "clientId, experimentId, and action are required" },
      { status: 400 }
    );
  }

  const audit = await loadLatestAuditFromSupabase(user.id, body.clientId);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const client = await loadBusinessConfig(user.id, body.clientId);

  if (body.action === "dismiss") {
    const experiment = await dismissSuggestedExperimentAdmin(body.experimentId);
    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }
    return NextResponse.json({ experiment });
  }

  try {
    const result = await activateSuggestedExperiment({
      experimentId: body.experimentId,
      audit,
      client,
      userId: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to activate suggestion" },
      { status: 409 }
    );
  }
}
