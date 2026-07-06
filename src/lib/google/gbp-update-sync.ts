import type { BusinessRecord } from "@/audit/businesses";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import {
  appendExecutionTasksAdmin,
  listExecutionTasksForBusinessAdmin,
} from "@/audit/storage-execution";
import type {
  ExecutionTask,
  FullAuditPayload,
  GbpConnection,
  GbpGoogleSuggestion,
  GbpGoogleUpdateState,
} from "@/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";
import {
  enrichGbpLocationProfile,
  fetchAllGoogleSuggestions,
  fetchGoogleUpdateState,
  getGbpLocationProfile,
} from "./gbp-location";
import { isGoogleUpdateResolved } from "./gbp-google-updated";
import { missingGoogleSuggestionTasks } from "./gbp-update-helpers";

export interface LiveGoogleUpdateState {
  googleUpdateState: GbpGoogleUpdateState;
  googleSuggestions: GbpGoogleSuggestion[];
  hasGoogleUpdated: boolean;
  noPendingEdits: boolean;
  resolved: boolean;
}

export async function fetchLiveGoogleUpdateState(
  connection: GbpConnection
): Promise<LiveGoogleUpdateState> {
  const profile = await enrichGbpLocationProfile(
    connection,
    await getGbpLocationProfile(connection)
  );
  const googleUpdateState = await fetchGoogleUpdateState(connection, profile);
  const googleSuggestions = await fetchAllGoogleSuggestions(connection, profile);

  return {
    googleUpdateState,
    googleSuggestions,
    hasGoogleUpdated: profile.hasGoogleUpdated,
    noPendingEdits: !profile.hasPendingEdits,
    resolved: isGoogleUpdateResolved(googleUpdateState.diffMask, profile.hasGoogleUpdated),
  };
}

export function applyGoogleUpdatePatchToAudit(
  audit: FullAuditPayload,
  live: LiveGoogleUpdateState
): FullAuditPayload {
  return {
    ...audit,
    gbp: {
      ...audit.gbp,
      googleUpdateState: live.googleUpdateState,
      googleSuggestions: live.googleSuggestions,
      hasGoogleUpdated: live.hasGoogleUpdated,
      completeness: {
        ...audit.gbp.completeness,
        noPendingEdits: live.noPendingEdits,
      },
    },
  };
}

async function patchAuditGbpGoogleStateAdmin(
  userId: string,
  businessId: string,
  audit: FullAuditPayload
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("audit_runs")
    .update({ payload: audit })
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("audit_id", audit.auditId);

  if (error) throw new Error(error.message);
}

async function clearGoogleUpdateTimestampAdmin(businessId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("businesses")
    .update({ gbp_google_update_at: null })
    .eq("id", businessId);

  if (error) throw new Error(error.message);
}

export interface SyncGoogleUpdatesResult {
  audit: FullAuditPayload | null;
  live: LiveGoogleUpdateState | null;
  createdTasks: ExecutionTask[];
  resolved: boolean;
}

/** Refresh live Google update state, patch audit payload, and ensure suggestion tasks. */
export async function syncGoogleUpdatesForBusiness(
  record: BusinessRecord,
  options?: { ensureTasks?: boolean }
): Promise<SyncGoogleUpdatesResult> {
  const connection = await getValidGbpConnectionForRecord(record);
  if (!connection) {
    return { audit: null, live: null, createdTasks: [], resolved: false };
  }

  const audit = await loadLatestAuditForBusinessAdmin(
    record.user_id,
    record.id,
    record.slug,
    record.name
  );
  if (!audit) {
    return { audit: null, live: null, createdTasks: [], resolved: false };
  }

  const live = await fetchLiveGoogleUpdateState(connection);
  const patchedAudit = applyGoogleUpdatePatchToAudit(audit, live);
  await patchAuditGbpGoogleStateAdmin(record.user_id, record.id, patchedAudit);

  let createdTasks: ExecutionTask[] = [];
  if (options?.ensureTasks !== false) {
    const existing = await listExecutionTasksForBusinessAdmin(
      record.user_id,
      record.id,
      patchedAudit.auditId
    );
    const missing = missingGoogleSuggestionTasks(patchedAudit, existing);
    if (missing.length > 0) {
      await appendExecutionTasksAdmin(record.user_id, record.id, missing);
      createdTasks = missing;
    }
  }

  if (live.resolved) {
    await clearGoogleUpdateTimestampAdmin(record.id);
  }

  return {
    audit: patchedAudit,
    live,
    createdTasks,
    resolved: live.resolved,
  };
}
