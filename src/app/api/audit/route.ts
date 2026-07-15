import { NextResponse } from "next/server";
import {
  getBusinessRecord,
  getPrimaryBusiness,
  listUserBusinesses,
  loadBusinessConfig,
} from "@/audit/businesses";
import {
  buildLiveAudit,
  persistLiveAuditSnapshot,
} from "@/audit/live-audit";
import { runPhase1Audit } from "@/audit/orchestrator";
import { reconcilePlanForUser } from "@/audit/phase3/reconcile-plan";
import { shouldReuseMarketData } from "@/audit/refresh-policy";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { PLAN_RECONCILE_FLAGS } from "@/lib/feature-flags";
import { getUser } from "@/lib/supabase/server";
import type { AuditTrigger, ClientConfig, FullAuditPayload } from "@/audit/types";

/** Vercel Pro serverless limit; audits should finish well under this after perf tuning. */
export const maxDuration = 300;

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await listUserBusinesses(user.id);
  const latest = await Promise.all(
    businesses.map(async (row) => {
      const latestAudit = await loadLatestAuditFromSupabase(user.id, row.slug);
      return {
        client: {
          id: row.slug,
          businessId: row.id,
          name: row.name,
          onboardingComplete: row.onboarding_complete,
          gbpConnected: Boolean(row.gbp_location_id),
        },
        latestAudit,
      };
    })
  );

  return NextResponse.json({ user: { id: user.id, email: user.email }, clients: latest });
}

async function reconcileAfterProfileRefresh(
  userId: string,
  client: ClientConfig,
  audit: FullAuditPayload
): Promise<FullAuditPayload> {
  if (!PLAN_RECONCILE_FLAGS.enabled) return audit;

  try {
    const result = await reconcilePlanForUser(userId, client, {
      auditId: audit.auditId,
    });
    return result?.audit ?? audit;
  } catch (error) {
    console.error("[api/audit] plan reconcile after profile refresh failed:", error);
    return audit;
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      clientId?: string;
      trigger?: AuditTrigger;
    };

    const business = body.clientId
      ? await loadBusinessConfig(user.id, body.clientId)
      : await getPrimaryBusiness(user.id);

    if (!business) {
      return NextResponse.json(
        { error: "No business found. Complete onboarding first." },
        { status: 400 }
      );
    }

    const trigger = body.trigger ?? "manual";
    if (shouldReuseMarketData(trigger, Boolean(business.businessId)) && business.businessId) {
      const row = await getBusinessRecord(user.id, business.businessId);
      if (row) {
        const bundle = await buildLiveAudit(row.id, {
          refreshGbp: true,
          businessRow: row,
          userId: user.id,
          clientSlug: row.slug,
          avgCustomerValue: row.avg_customer_value,
          currency: row.avg_customer_value_currency,
        });
        if (bundle) {
          await persistLiveAuditSnapshot(row.id, bundle.audit);
          const audit = await reconcileAfterProfileRefresh(user.id, business, bundle.audit);
          return NextResponse.json({
            success: true,
            audit,
            storagePath: `supabase://audit_runs/${row.id}/latest`,
            marketDataReused: true,
            refreshedAt: bundle.refreshedAt,
            planReconciledAt: audit.strategy.planReconciledAt ?? null,
          });
        }
      }
    }

    const result = await runPhase1Audit({
      clientId: business.id,
      trigger,
      userId: user.id,
      userEmail: user.email ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
