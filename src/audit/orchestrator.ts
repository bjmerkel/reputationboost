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
import { isLocalStorageAvailable } from "./storage-env";
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

  const storagePath = await persistAudit(audit, options.userId, client);

  return {
    success: true,
    audit,
    storagePath,
  };
}

async function persistAudit(
  audit: Phase1AuditPayload,
  userId: string | undefined,
  client: ReturnType<typeof getClientConfig>
): Promise<string> {
  if (userId && isSupabaseConfigured()) {
    const businessId = await ensureDemoBusiness(userId, client);
    await saveAuditToSupabase(userId, businessId, audit);
    return `supabase://audit_runs/${businessId}/${audit.auditId}`;
  }

  if (isLocalStorageAvailable()) {
    return saveAudit(audit);
  }

  throw new Error(
    "Cannot persist audit: sign in and configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
  );
}
