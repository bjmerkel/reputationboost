import { getClientConfig } from "./clients";
import {
  collectCompetitorSnapshots,
  collectGbpSnapshot,
  collectOffGoogleSnapshot,
  collectRankSnapshot,
  collectReviewSnapshot,
} from "./collectors";
import {
  ensureDemoBusiness,
  isSupabaseConfigured,
  saveAuditToSupabase,
} from "./storage-supabase";
import { saveAudit } from "./storage";
import type { AuditRunResult, AuditTrigger, Phase1AuditPayload } from "./types";

function auditIdForDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function periodLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export interface RunAuditOptions {
  clientId: string;
  trigger?: AuditTrigger;
  userId?: string;
}

/**
 * Phase 1 — Data collection orchestrator.
 * Runs all collectors in parallel, persists snapshot, returns payload.
 */
export async function runPhase1Audit(
  clientIdOrOptions: string | RunAuditOptions,
  trigger: AuditTrigger = "manual"
): Promise<AuditRunResult> {
  const options: RunAuditOptions =
    typeof clientIdOrOptions === "string"
      ? { clientId: clientIdOrOptions, trigger }
      : { trigger, ...clientIdOrOptions };

  const startedAt = new Date();
  const client = getClientConfig(options.clientId);

  const [gbp, rankings, competitors, reviews, offGoogle] = await Promise.all([
    collectGbpSnapshot(client),
    collectRankSnapshot(client),
    collectCompetitorSnapshots(client),
    collectReviewSnapshot(client),
    collectOffGoogleSnapshot(client),
  ]);

  const completedAt = new Date();

  const audit: Phase1AuditPayload = {
    clientId: client.id,
    clientName: client.name,
    userId: options.userId,
    auditId: auditIdForDate(completedAt),
    trigger: options.trigger ?? "manual",
    period: periodLabel(completedAt),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    gbp,
    rankings,
    competitors,
    reviews,
    offGoogle,
  };

  let storagePath = await saveAudit(audit);

  if (options.userId && isSupabaseConfigured()) {
    const businessId = await ensureDemoBusiness(options.userId, client);
    await saveAuditToSupabase(options.userId, businessId, audit);
    storagePath = `supabase://audit_runs/${businessId}/${audit.auditId}`;
  }

  return {
    success: true,
    audit,
    storagePath,
  };
}
