import { NextResponse } from "next/server";
import {
  getBusinessRecord,
  loadBusinessConfig,
  saveManualRankRefreshAt,
} from "@/audit/businesses";
import { buildAndPersistLiveAuditForBusiness } from "@/audit/live-audit";
import { manualRefreshCooldown } from "@/audit/market/cooldown";
import { runRankPulseForBusiness } from "@/audit/market/rank-pulse";
import { MARKET_REFRESH_FLAGS } from "@/lib/feature-flags";
import { getPlacesMonthlyUsage } from "@/lib/google/places-cost-governance";
import { getUser } from "@/lib/supabase/server";

export const maxDuration = 120;

function todayYmd(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as { clientId?: string };
    if (!body.clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }
    const client = await loadBusinessConfig(user.id, body.clientId);
    if (!client.businessId) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    const row = await getBusinessRecord(user.id, client.businessId);
    if (!row) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const now = new Date();
    const cooldown = manualRefreshCooldown(
      row.last_manual_rank_refresh_at,
      now,
      MARKET_REFRESH_FLAGS.manualCooldownDays
    );
    if (!cooldown.canRefresh) {
      return NextResponse.json(
        {
          error: "Rankings were refreshed recently.",
          availableAt: cooldown.availableAt,
        },
        { status: 409 }
      );
    }

    const usage = await getPlacesMonthlyUsage(row.id, now);
    if (usage.callsRemaining < 3) {
      return NextResponse.json(
        { error: "Monthly Places budget exhausted.", ...usage },
        { status: 429 }
      );
    }

    const date = todayYmd(now);
    const pulse = await runRankPulseForBusiness({
      row,
      observationDate: date,
      collectionDate: date,
      collectionType: "manual_rank_pulse",
    });
    if (pulse.skipped) {
      const status = pulse.skipReason === "budget" ? 429 : 409;
      return NextResponse.json(
        { error: `Rank refresh skipped: ${pulse.skipReason}`, pulse },
        { status }
      );
    }

    await saveManualRankRefreshAt(user.id, row.id, now.toISOString());
    await buildAndPersistLiveAuditForBusiness(row, date);
    const updatedUsage = await getPlacesMonthlyUsage(row.id, now);
    return NextResponse.json({
      ok: true,
      pulse,
      ...updatedUsage,
      marketObservedAt: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rank refresh failed" },
      { status: 500 }
    );
  }
}
