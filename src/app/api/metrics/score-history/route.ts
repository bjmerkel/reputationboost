import { NextResponse } from "next/server";
import {
  buildRankMovementsForChangelog,
  buildScoreChangelogFromSnapshots,
} from "@/audit/phase2/score-changelog";
import {
  applyGridSnapshotsToAudit,
  applyRankSnapshotsToAudit,
} from "@/audit/phase2/score-snapshot";
import {
  DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
  smoothRankSnapshotsForDate,
} from "@/audit/phase2/rank-median";
import { keywordMapFromRankSnapshots } from "@/audit/phase2/service-area-attribution";
import { radiusWeightsForAudit } from "@/audit/phase2/radius-profiles";
import { backfillScoreDailyForBusiness } from "@/audit/phase2/score-ingest";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { loadGlobalScoreModel } from "@/audit/storage-score-model";
import { loadLatestKeywordGridsAdmin } from "@/audit/storage-grid-snapshots";
import {
  listRankSnapshotsForBusinessDate,
  listRankSnapshotsForBusinessRange,
  loadLatestAuditForBusinessAdmin,
  listScoreDailyForUser,
} from "@/audit/storage-score-daily";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";
import { getUser } from "@/lib/supabase/server";

function addDaysYmd(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

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

  const [initialSeries, globalCalibration, scoreModel] = await Promise.all([
    listScoreDailyForUser(user.id, clientId, days),
    loadGlobalScoreCalibration(),
    loadGlobalScoreModel(),
  ]);

  let series = initialSeries;
  if (series.length < 2) {
    const businessId = await getBusinessIdForSlug(user.id, clientId);
    if (businessId) {
      const backfilled = await backfillScoreDailyForBusiness(businessId, days);
      if (backfilled > 0) {
        series = await listScoreDailyForUser(user.id, clientId, days);
      }
    }
  }

  let changelog: ReturnType<typeof buildScoreChangelogFromSnapshots> = [];
  const latest = series[series.length - 1];
  const prior = series.length >= 2 ? series[series.length - 2] : null;

  if (latest && prior) {
    const businessId = await getBusinessIdForSlug(user.id, clientId);

    if (businessId) {
      const [currentSnaps, priorSnaps, audit] = await Promise.all([
        listRankSnapshotsForBusinessDate(businessId, latest.date, {
          multiRadius: HEATMAP_FLAGS.dailyMultiRadius,
        }),
        listRankSnapshotsForBusinessDate(businessId, prior.date, {
          multiRadius: HEATMAP_FLAGS.dailyMultiRadius,
        }),
        loadLatestAuditForBusinessAdmin(businessId),
      ]);

      const keywords = audit?.rankings.keywords.map((k) => k.keyword) ?? [
        ...new Set(currentSnaps.map((s) => s.keyword)),
      ];

      const currentRanks = new Map<string, number | null>();
      const priorRanks = new Map<string, number | null>();
      for (const s of currentSnaps.filter((r) => r.distanceMiles === 1)) {
        currentRanks.set(s.keyword, s.rank);
      }
      for (const s of priorSnaps.filter((r) => r.distanceMiles === 1)) {
        priorRanks.set(s.keyword, s.rank);
      }

      let priorKeywords: Map<string, import("@/audit/types").KeywordRankSnapshot> | undefined;
      let keywordRanks: Map<string, import("@/audit/types").KeywordRankSnapshot> | undefined;
      const weights = audit ? radiusWeightsForAudit(audit) : undefined;

      if (audit) {
        const startDate = addDaysYmd(
          latest.date,
          -(DEFAULT_RANK_MEDIAN_WINDOW_DAYS - 1)
        );
        const priorStart = addDaysYmd(
          prior.date,
          -(DEFAULT_RANK_MEDIAN_WINDOW_DAYS - 1)
        );

        const [currentRangeSnaps, priorRangeSnaps, grids] = await Promise.all([
          listRankSnapshotsForBusinessRange(businessId, startDate, latest.date, {
            multiRadius: HEATMAP_FLAGS.dailyMultiRadius,
          }),
          listRankSnapshotsForBusinessRange(businessId, priorStart, prior.date, {
            multiRadius: HEATMAP_FLAGS.dailyMultiRadius,
          }),
          loadLatestKeywordGridsAdmin(businessId, keywords, latest.date),
        ]);

        const currentSmoothed = smoothRankSnapshotsForDate(
          currentRangeSnaps,
          latest.date,
          keywords,
          DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
          { multiRadius: HEATMAP_FLAGS.dailyMultiRadius }
        );
        const priorSmoothed = smoothRankSnapshotsForDate(
          priorRangeSnaps,
          prior.date,
          keywords,
          DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
          { multiRadius: HEATMAP_FLAGS.dailyMultiRadius }
        );

        let liveAudit = applyRankSnapshotsToAudit(audit, currentSmoothed);
        liveAudit = applyGridSnapshotsToAudit(liveAudit, grids);
        keywordRanks = keywordMapFromRankSnapshots(liveAudit, currentSmoothed);

        const priorAudit = applyRankSnapshotsToAudit(audit, priorSmoothed);
        priorKeywords = keywordMapFromRankSnapshots(priorAudit, priorSmoothed);
      }

      const rankMovements = buildRankMovementsForChangelog(
        keywords,
        priorKeywords,
        keywordRanks,
        currentRanks,
        priorRanks,
        weights
      );

      changelog = buildScoreChangelogFromSnapshots(
        latest,
        prior,
        rankMovements,
        keywordRanks
      );
    }
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
