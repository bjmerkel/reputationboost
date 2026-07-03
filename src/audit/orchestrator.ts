import { loadBusinessConfig } from "./businesses";
import {
  collectCompetitorSnapshots,
  collectGbpSnapshot,
  collectOffGoogleSnapshot,
  collectRankSnapshot,
  collectReviewSnapshot,
} from "./collectors";
import { collectPlacesRankData } from "./collectors/places";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { generateStrategy } from "@/lib/llm/strategy";
import { generateAuditContent } from "@/lib/llm/content";
import { generateExecutionQueue } from "./phase3";
import {
  getBusinessIdForSlug,
  isSupabaseConfigured,
  loadPriorAuditFromSupabase,
  saveAuditToSupabase,
} from "./storage-supabase";
import { saveExecutionTasks } from "./storage-execution";
import type {
  AuditRunResult,
  AuditTrigger,
  ClientConfig,
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
  userId: string;
  userEmail?: string;
}

async function loadPriorForDiff(
  clientId: string,
  userId: string,
  beforeCompletedAt: string
): Promise<Phase1AuditPayload | null> {
  if (isSupabaseConfigured()) {
    return loadPriorAuditFromSupabase(userId, clientId, beforeCompletedAt);
  }
  return null;
}

async function resolveClient(options: RunAuditOptions): Promise<ClientConfig> {
  return loadBusinessConfig(options.userId, options.clientId);
}

/**
 * Full audit pipeline: Phase 1 data collection + Phase 2 strategy + Phase 3 execution queue.
 */
export async function runPhase1Audit(
  clientIdOrOptions: string | RunAuditOptions,
  trigger: AuditTrigger = "manual"
): Promise<AuditRunResult> {
  const options: RunAuditOptions =
    typeof clientIdOrOptions === "string"
      ? { clientId: clientIdOrOptions, trigger, userId: "" }
      : { trigger, ...clientIdOrOptions };

  if (!options.userId) {
    throw new Error("Sign in required to run audits.");
  }

  const startedAt = new Date();
  const client = await resolveClient(options);

  if (!client.onboardingComplete || !client.gbpConnection) {
    throw new Error("Connect your Google Business Profile in onboarding before running an audit.");
  }

  const connection = await getValidGbpConnection(options.userId, client);
  if (!connection) {
    throw new Error("GBP connection expired. Reconnect your Google Business Profile.");
  }

  const useGooglePlaces = isGoogleMapsConfigured();

  const [gbp, reviews, offGoogle, placesData] = await Promise.all([
    collectGbpSnapshot(client, connection, { userEmail: options.userEmail }),
    collectReviewSnapshot(client, connection),
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
  await saveExecutionTasks(options.userId, client, audit.auditId, execution.tasks);

  return {
    success: true,
    audit,
    storagePath,
  };
}

async function persistAudit(
  audit: FullAuditPayload,
  userId: string,
  client: ClientConfig
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const businessId =
    client.businessId ?? (await getBusinessIdForSlug(userId, client.id));
  if (!businessId) {
    throw new Error("Business record not found.");
  }

  await saveAuditToSupabase(userId, businessId, audit);
  return `supabase://audit_runs/${businessId}/${audit.auditId}`;
}
