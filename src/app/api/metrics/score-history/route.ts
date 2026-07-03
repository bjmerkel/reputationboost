import { NextResponse } from "next/server";
import {
  buildRankMovementsFromSnapshots,
  buildScoreChangelogFromSnapshots,
} from "@/audit/phase2/score-changelog";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { loadGlobalScoreModel } from "@/audit/storage-score-model";
import {
  listRankSnapshotsForBusinessDate,
  listScoreDailyForUser,
} from "@/audit/storage-score-daily";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const days = Number(searchParams.get("days") ?? "30");

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const [series, globalCalibration, scoreModel] = await Promise.all([
    listScoreDailyForUser(user.id, clientId, days),
    loadGlobalScoreCalibration(),
    loadGlobalScoreModel(),
  ]);

  let changelog: ReturnType<typeof buildScoreChangelogFromSnapshots> = [];
  const latest = series[series.length - 1];
  const prior = series.length >= 2 ? series[series.length - 2] : null;

  if (latest && prior) {
    const businessId = await getBusinessIdForSlug(user.id, clientId);
    const keywords = latest && businessId
      ? (
          await listRankSnapshotsForBusinessDate(businessId, latest.date)
        ).map((r) => r.keyword)
      : [];

    const currentRanks = new Map<string, number | null>();
    const priorRanks = new Map<string, number | null>();

    if (businessId) {
      const [currentSnaps, priorSnaps] = await Promise.all([
        listRankSnapshotsForBusinessDate(businessId, latest.date),
        listRankSnapshotsForBusinessDate(businessId, prior.date),
      ]);
      for (const s of currentSnaps) currentRanks.set(s.keyword, s.rank);
      for (const s of priorSnaps) priorRanks.set(s.keyword, s.rank);
    }

    const rankMovements = buildRankMovementsFromSnapshots(
      keywords,
      currentRanks,
      priorRanks
    );
    changelog = buildScoreChangelogFromSnapshots(latest, prior, rankMovements);
  }

  const liveScores =
    latest != null
      ? {
          overall: latest.overall,
          visibility: latest.visibility,
          conversion: latest.conversion,
          revenueCapture: latest.revenueCapture,
          date: latest.date,
        }
      : null;

  return NextResponse.json({
    series,
    changelog,
    latestDate: latest?.date ?? null,
    liveScores,
    globalCalibration,
    scoreModel,
    days,
  });
}
