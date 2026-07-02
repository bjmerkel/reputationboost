import { getClientConfig } from "./clients";
import {
  collectCompetitorSnapshots,
  collectGbpSnapshot,
  collectOffGoogleSnapshot,
  collectRankSnapshot,
  collectReviewSnapshot,
} from "./collectors";
import { collectPlacesRankData } from "./collectors/places";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { generateStrategy } from "@/lib/llm/strategy";
import { generateAuditContent } from "@/lib/llm/content";
import { generateExecutionQueue } from "./phase3";
import {
  ensureDemoBusiness,
  isSupabaseConfigured,
  loadPriorAuditFromSupabase,
  saveAuditToSupabase,
} from "./storage-supabase";
import { saveExecutionTasks } from "./storage-execution";
import { isLocalStorageAvailable } from "./storage-env";
import { loadPriorAudit, saveAudit } from "./storage";
import type {
  AuditRunResult,
  AuditTrigger,
  FullAuditPayload,
  Phase1AuditPayload,
} from "./types";

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

async function loadPriorForDiff(
  clientId: string,
  userId: string | undefined,
  beforeCompletedAt: string
): Promise<Phase1AuditPayload | null> {
  if (userId && isSupabaseConfigured()) {
    const prior = await loadPriorAuditFromSupabase(userId, clientId, beforeCompletedAt);
    return prior;
  }
  if (isLocalStorageAvailable()) {
    return loadPriorAudit(clientId, beforeCompletedAt);
  }
  return null;
}

/**
 * Full audit pipeline: Phase 1 data collection + Phase 2 scoring & strategy.
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

  const useGooglePlaces = isGoogleMapsConfigured();

  const [gbp, reviews, offGoogle, placesData] = await Promise.all([
    collectGbpSnapshot(client),
    collectReviewSnapshot(client),
    collectOffGoogleSnapshot(client),
    useGooglePlaces ? collectPlacesRankData(client) : Promise.resolve(null),
  ]);

  let rankings = placesData?.rankings;
  let competitors = placesData?.competitors;

  if (!placesData) {
    [rankings, competitors] = await Promise.all([
      collectRankSnapshot(client),
      collectCompetitorSnapshots(client),
    ]);
  }

  const completedAt = new Date();

  const phase1: Phase1AuditPayload = {
    clientId: client.id,
    clientName: client.name,
    userId: options.userId,
    auditId: auditIdForDate(completedAt),
    trigger: options.trigger ?? "manual",
    period: periodLabel(completedAt),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    gbp,
    rankings: rankings!,
    competitors: competitors!,
    reviews,
    offGoogle,
  };

  const priorAudit = await loadPriorForDiff(
    client.id,
    options.userId,
    phase1.completedAt
  );

  const strategy = await generateStrategy(phase1, priorAudit);

  const auditWithStrategy = { ...phase1, strategy };
  const content = await generateAuditContent(auditWithStrategy);
  const execution = generateExecutionQueue(auditWithStrategy, content);

  const audit: FullAuditPayload = {
    ...auditWithStrategy,
    execution,
  };

  const storagePath = await persistAudit(audit, options.userId, client);

  if (options.userId && isSupabaseConfigured()) {
    await saveExecutionTasks(options.userId, client, audit.auditId, execution.tasks);
  }

  return {
    success: true,
    audit,
    storagePath,
  };
}

async function persistAudit(
  audit: FullAuditPayload,
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
