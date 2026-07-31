import { createAdminClient } from "@/lib/supabase/admin";
import { gradeFromScore } from "@/lib/scores/grade";
import type { HealthGrade } from "@/audit/types";

export interface PlatformScorePoint {
  date: string;
  avgOverall: number;
  businessCount: number;
}

export interface IndustryScoreRow {
  industry: string;
  businessCount: number;
  avgScore: number;
  grade: HealthGrade;
}

export interface ScoreMoverRow {
  businessId: string;
  businessName: string;
  userId: string;
  currentScore: number;
  delta7d: number;
}

export interface AdminScoresData {
  businessCount: number;
  avgOverall: number | null;
  medianOverall: number | null;
  gradeDistribution: Record<HealthGrade, number>;
  componentAverages: {
    visibility: number | null;
    conversion: number | null;
    revenueCapture: number | null;
    driverScore: number | null;
    outcomeIndex: number | null;
  };
  platformTrend: PlatformScorePoint[];
  topMoversUp: ScoreMoverRow[];
  topMoversDown: ScoreMoverRow[];
  industryBreakdown: IndustryScoreRow[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function getAdminScoresData(): Promise<AdminScoresData> {
  const supabase = createAdminClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysAgoDate = sevenDaysAgo.toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const ninetyDaysAgoDate = ninetyDaysAgo.toISOString().slice(0, 10);

  const [latestScoresRes, historyRes, businessesRes] = await Promise.all([
    supabase
      .from("admin_latest_scores")
      .select("business_id, overall, visibility, conversion, revenue_capture, driver_score, outcome_index"),
    supabase
      .from("score_daily")
      .select("business_id, date, overall")
      .gte("date", ninetyDaysAgoDate)
      .order("date", { ascending: true }),
    supabase.from("businesses").select("id, user_id, name, industry"),
  ]);

  const latestScores = latestScoresRes.data ?? [];
  const overalls = latestScores.map((row) => row.overall as number);

  const gradeDistribution: Record<HealthGrade, number> = {
    healthy: 0,
    at_risk: 0,
    urgent: 0,
  };
  for (const score of overalls) {
    gradeDistribution[gradeFromScore(score)] += 1;
  }

  const businessMap = new Map(
    (businessesRes.data ?? []).map((row) => [
      row.id as string,
      {
        name: row.name as string,
        userId: row.user_id as string,
        industry: (row.industry as string) || "Unknown",
      },
    ])
  );

  const latestByBusiness = new Map<string, number>();
  for (const row of latestScores) {
    latestByBusiness.set(row.business_id as string, row.overall as number);
  }

  const historyByBusiness = new Map<string, Array<{ date: string; overall: number }>>();
  for (const row of historyRes.data ?? []) {
    const businessId = row.business_id as string;
    const entries = historyByBusiness.get(businessId) ?? [];
    entries.push({ date: row.date as string, overall: row.overall as number });
    historyByBusiness.set(businessId, entries);
  }

  const movers: ScoreMoverRow[] = [];
  for (const [businessId, currentScore] of latestByBusiness) {
    const history = historyByBusiness.get(businessId) ?? [];
    const baseline = history.find((point) => point.date <= sevenDaysAgoDate);
    if (!baseline) continue;
    const delta7d = currentScore - baseline.overall;
    if (Math.abs(delta7d) < 3) continue;
    const business = businessMap.get(businessId);
    if (!business) continue;
    movers.push({
      businessId,
      businessName: business.name,
      userId: business.userId,
      currentScore,
      delta7d,
    });
  }

  const topMoversUp = [...movers]
    .filter((row) => row.delta7d > 0)
    .sort((a, b) => b.delta7d - a.delta7d)
    .slice(0, 10);
  const topMoversDown = [...movers]
    .filter((row) => row.delta7d < 0)
    .sort((a, b) => a.delta7d - b.delta7d)
    .slice(0, 10);

  const byDate = new Map<string, number[]>();
  for (const row of historyRes.data ?? []) {
    const date = row.date as string;
    const values = byDate.get(date) ?? [];
    values.push(row.overall as number);
    byDate.set(date, values);
  }
  const platformTrend: PlatformScorePoint[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      avgOverall: average(values) ?? 0,
      businessCount: values.length,
    }));

  const industryScores = new Map<string, number[]>();
  for (const row of latestScores) {
    const business = businessMap.get(row.business_id as string);
    if (!business) continue;
    const scores = industryScores.get(business.industry) ?? [];
    scores.push(row.overall as number);
    industryScores.set(business.industry, scores);
  }

  const industryBreakdown: IndustryScoreRow[] = [...industryScores.entries()]
    .map(([industry, scores]) => {
      const avgScore = average(scores) ?? 0;
      return {
        industry,
        businessCount: scores.length,
        avgScore,
        grade: gradeFromScore(avgScore),
      };
    })
    .sort((a, b) => b.businessCount - a.businessCount)
    .slice(0, 12);

  const visibility = latestScores
    .map((row) => row.visibility as number | null)
    .filter((value): value is number => value !== null);
  const conversion = latestScores
    .map((row) => row.conversion as number | null)
    .filter((value): value is number => value !== null);
  const revenueCapture = latestScores
    .map((row) => row.revenue_capture as number | null)
    .filter((value): value is number => value !== null);
  const driverScore = latestScores
    .map((row) => row.driver_score as number | null)
    .filter((value): value is number => value !== null);
  const outcomeIndex = latestScores
    .map((row) => row.outcome_index as number | null)
    .filter((value): value is number => value !== null);

  return {
    businessCount: latestScores.length,
    avgOverall: average(overalls),
    medianOverall: median(overalls),
    gradeDistribution,
    componentAverages: {
      visibility: average(visibility),
      conversion: average(conversion),
      revenueCapture: average(revenueCapture),
      driverScore: average(driverScore),
      outcomeIndex: average(outcomeIndex),
    },
    platformTrend,
    topMoversUp,
    topMoversDown,
    industryBreakdown,
  };
}
