import { collectGbpSnapshot, collectReviewSnapshot } from "@/audit/collectors";
import { loadOutcomesForStrategy } from "@/audit/outcomes/load-outcomes";
import type { OutcomesContext } from "@/audit/outcomes/types";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import {
  applyGridSnapshotsToAudit,
  applyRankSnapshotsToAudit,
} from "@/audit/phase2/score-snapshot";
import {
  DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
  smoothRankSnapshotsForDate,
} from "@/audit/phase2/rank-median";
import { buildStrategy } from "@/audit/phase2/strategy";
import type { BusinessRecord } from "@/audit/businesses";
import { businessRecordToClientConfig } from "@/audit/businesses";
import { loadLatestKeywordGridsAdmin } from "@/audit/storage-grid-snapshots";
import {
  listRankSnapshotsForBusinessRange,
  loadLatestAuditForBusinessAdmin,
} from "@/audit/storage-score-daily";
import type {
  FullAuditPayload,
  GbpSnapshot,
  PathToHealthy,
  Phase1AuditPayload,
  ReviewSnapshot,
} from "@/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysYmd(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export interface HydrateAuditOptions {
  targetDate?: string;
  windowDays?: number;
}

/** Overlay nightly rank + weekly grid snapshots onto a stored audit. */
export async function hydrateAuditFromTimeseries(
  audit: FullAuditPayload,
  businessId: string,
  options: HydrateAuditOptions = {}
): Promise<FullAuditPayload> {
  const targetDate = options.targetDate ?? formatDateYmd(new Date());
  const windowDays = options.windowDays ?? DEFAULT_RANK_MEDIAN_WINDOW_DAYS;
  const startDate = addDaysYmd(targetDate, -(windowDays - 1));

  const keywords = audit.rankings.keywords.map((kw) => kw.keyword);
  const snapshots = await listRankSnapshotsForBusinessRange(
    businessId,
    startDate,
    targetDate,
    { multiRadius: HEATMAP_FLAGS.dailyMultiRadius }
  );
  const smoothed = smoothRankSnapshotsForDate(
    snapshots,
    targetDate,
    keywords,
    windowDays,
    { multiRadius: HEATMAP_FLAGS.dailyMultiRadius }
  );

  let hydrated = applyRankSnapshotsToAudit(audit, smoothed);
  const grids = await loadLatestKeywordGridsAdmin(businessId, keywords, targetDate);
  hydrated = applyGridSnapshotsToAudit(hydrated, grids);

  return hydrated;
}

/** Pull fresh GBP profile + review slices (no Places rank/grid collection). */
export async function refreshGbpSlicesForBusiness(
  row: BusinessRecord
): Promise<{ gbp: GbpSnapshot; reviews: ReviewSnapshot } | null> {
  const connection = await getValidGbpConnectionForRecord(row);
  if (!connection) return null;

  const client = businessRecordToClientConfig(row);
  const [gbp, reviews] = await Promise.all([
    collectGbpSnapshot(client, connection),
    collectReviewSnapshot(client, connection),
  ]);

  return { gbp, reviews };
}

function mergeRefreshedGbp(
  audit: FullAuditPayload,
  gbp: GbpSnapshot,
  reviews: ReviewSnapshot
): FullAuditPayload {
  return {
    ...audit,
    gbp,
    reviews,
  };
}

function mergeLiveStrategy(
  stored: FullAuditPayload,
  hydrated: Phase1AuditPayload,
  priorAudit: Phase1AuditPayload | null,
  outcomes: OutcomesContext | null
): FullAuditPayload {
  const freshStrategy = buildStrategy(hydrated, priorAudit, outcomes);
  const preserved = stored.strategy;

  return {
    ...hydrated,
    strategy: {
      ...freshStrategy,
      gbpPlan: preserved?.gbpPlan ?? freshStrategy.gbpPlan,
      monthlyReport: preserved?.monthlyReport ?? freshStrategy.monthlyReport,
      contentSource: preserved?.contentSource ?? freshStrategy.contentSource,
      executiveSummary:
        preserved?.contentSource === "llm" && preserved.executiveSummary
          ? preserved.executiveSummary
          : freshStrategy.executiveSummary,
    },
    execution: stored.execution,
  };
}

async function loadPriorAuditForBusinessAdmin(
  businessId: string,
  beforeCompletedAt: string
): Promise<FullAuditPayload | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_runs")
    .select("payload, completed_at")
    .eq("business_id", businessId)
    .lt("completed_at", beforeCompletedAt)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return null;
  return data.payload as FullAuditPayload;
}

export interface BuildLiveAuditOptions extends HydrateAuditOptions {
  refreshGbp?: boolean;
  businessRow?: BusinessRecord;
  userId?: string;
  clientSlug?: string;
  avgCustomerValue?: number | null;
  currency?: string;
}

export interface LiveAuditBundle {
  audit: FullAuditPayload;
  pathToHealthy: PathToHealthy | null;
  refreshedAt: string;
  targetDate: string;
  gbpRefreshed: boolean;
}

export async function buildLiveAudit(
  businessId: string,
  options: BuildLiveAuditOptions = {}
): Promise<LiveAuditBundle | null> {
  const stored = await loadLatestAuditForBusinessAdmin(businessId);
  if (!stored) return null;

  const targetDate = options.targetDate ?? formatDateYmd(new Date());
  let working: FullAuditPayload = stored;
  let gbpRefreshed = false;

  if (options.refreshGbp && options.businessRow) {
    const slices = await refreshGbpSlicesForBusiness(options.businessRow);
    if (slices) {
      working = mergeRefreshedGbp(working, slices.gbp, slices.reviews);
      gbpRefreshed = true;
    }
  }

  const hydrated = await hydrateAuditFromTimeseries(working, businessId, {
    targetDate,
    windowDays: options.windowDays,
  });

  const priorAudit = await loadPriorAuditForBusinessAdmin(
    businessId,
    stored.completedAt
  );

  let outcomes: OutcomesContext | null = null;
  if (options.userId && options.clientSlug) {
    outcomes = await loadOutcomesForStrategy(
      options.userId,
      options.clientSlug,
      priorAudit
    );
  }

  const audit = mergeLiveStrategy(stored, hydrated, priorAudit, outcomes);
  const pathToHealthy = buildPathToHealthy(audit, null, {
    avgCustomerValue: options.avgCustomerValue,
    currency: options.currency ?? "USD",
  });

  return {
    audit,
    pathToHealthy,
    refreshedAt: new Date().toISOString(),
    targetDate,
    gbpRefreshed,
  };
}

/** Persist hydrated rankings + strategy onto the latest audit_runs row (keeps audit_id). */
export async function persistLiveAuditSnapshot(
  businessId: string,
  audit: FullAuditPayload
): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_runs")
    .select("audit_id")
    .eq("business_id", businessId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.audit_id) return;

  const { error: updateError } = await supabase
    .from("audit_runs")
    .update({ payload: audit })
    .eq("business_id", businessId)
    .eq("audit_id", data.audit_id);

  if (updateError) {
    throw new Error(`Failed to persist live audit snapshot: ${updateError.message}`);
  }
}

export async function buildAndPersistLiveAuditForBusiness(
  row: BusinessRecord,
  targetDate: string
): Promise<boolean> {
  const bundle = await buildLiveAudit(row.id, {
    targetDate,
    refreshGbp: true,
    businessRow: row,
    userId: row.user_id,
    clientSlug: row.slug,
    avgCustomerValue: row.avg_customer_value,
    currency: row.avg_customer_value_currency,
  });

  if (!bundle) return false;

  await persistLiveAuditSnapshot(row.id, bundle.audit);
  return true;
}

import { mergeLiveAuditState } from "@/audit/live-audit-merge";