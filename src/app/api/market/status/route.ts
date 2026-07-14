import { NextResponse } from "next/server";
import { getBusinessRecord, loadBusinessConfig } from "@/audit/businesses";
import { manualRefreshCooldown } from "@/audit/market/cooldown";
import { getPendingMarketRefreshForBusiness } from "@/audit/market/refresh-queue";
import { nextScheduledRankPulse } from "@/audit/market/status";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { MARKET_REFRESH_FLAGS } from "@/lib/feature-flags";
import { getPlacesMonthlyUsage } from "@/lib/google/places-cost-governance";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const client = await loadBusinessConfig(user.id, clientId);
    if (!client.businessId) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    const row = await getBusinessRecord(user.id, client.businessId);
    if (!row) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    const now = new Date();
    const [usage, pending, audit] = await Promise.all([
      getPlacesMonthlyUsage(row.id, now),
      getPendingMarketRefreshForBusiness(row.id),
      loadLatestAuditForBusinessAdmin(row.user_id, row.id, row.slug, row.name),
    ]);
    const cooldown = manualRefreshCooldown(
      row.last_manual_rank_refresh_at,
      now,
      MARKET_REFRESH_FLAGS.manualCooldownDays
    );

    return NextResponse.json({
      ...usage,
      canRefresh: cooldown.canRefresh && usage.callsRemaining >= 3,
      cooldownAvailableAt: cooldown.availableAt,
      lastManualRefreshAt: row.last_manual_rank_refresh_at,
      marketObservedAt: audit?.rankings.collectedAt ?? null,
      nextScheduledAt: nextScheduledRankPulse(now),
      pendingRefreshAt: pending?.runAfter ?? null,
      pendingTrigger: pending?.triggerSource ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load market status" },
      { status: 500 }
    );
  }
}
