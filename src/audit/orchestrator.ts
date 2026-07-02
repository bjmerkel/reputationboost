import { getClientConfig } from "./clients";
import {
  collectCompetitorSnapshots,
  collectGbpSnapshot,
  collectOffGoogleSnapshot,
  collectRankSnapshot,
  collectReviewSnapshot,
} from "./collectors";
import { saveAudit } from "./storage";
import type { AuditRunResult, AuditTrigger, Phase1AuditPayload } from "./types";

function auditIdForDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function periodLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/**
 * Phase 1 — Data collection orchestrator.
 * Runs all collectors in parallel, persists snapshot, returns payload.
 */
export async function runPhase1Audit(
  clientId: string,
  trigger: AuditTrigger = "manual"
): Promise<AuditRunResult> {
  const startedAt = new Date();
  const client = getClientConfig(clientId);

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
    auditId: auditIdForDate(completedAt),
    trigger,
    period: periodLabel(completedAt),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    gbp,
    rankings,
    competitors,
    reviews,
    offGoogle,
  };

  const storagePath = await saveAudit(audit);

  return {
    success: true,
    audit,
    storagePath,
  };
}
