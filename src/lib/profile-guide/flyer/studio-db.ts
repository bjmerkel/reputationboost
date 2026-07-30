import { createClient } from "@/lib/supabase/server";
import { logFlyerEvent } from "@/lib/analytics/flyer-events";
import { FLYER_FORMAT_SPECS, parseProfileGuideFlyerFormat } from "./formats";
import { FLYER_PROMPT_VERSION } from "./prompt-version";
import {
  parseFlyerStudioState,
  type FlyerHistoryEntry,
  type FlyerStudioPersistedState,
} from "./studio-storage";

const MAX_FLYER_HISTORY = 3;

function formatFlyerStudioError(message: string): string {
  if (
    message.includes("Could not find the table") ||
    message.includes('relation "public.profile_guide_flyer_studio" does not exist')
  ) {
    return "Profile Guide flyer studio table not found. Run migration 050_profile_guide_flyer_studio.sql in Supabase.";
  }
  return message;
}

function rowToFlyerStudioState(row: Record<string, unknown>): FlyerStudioPersistedState | null {
  return parseFlyerStudioState({
    version: 1,
    template: row.template,
    format: row.format,
    promptRefinement: row.prompt_refinement,
    displayOptions: row.display_options,
    preview: row.preview_url,
    studioCache:
      row.background_url || row.image_prompt || row.copy
        ? {
            backgroundDataUrl: row.background_url,
            imagePrompt: row.image_prompt,
            copy: row.copy,
          }
        : null,
    history: row.history,
    selectedHistoryId: row.selected_history_id,
    archetype: row.archetype,
    archetypeOverride: row.archetype_override,
    selectedCoverUrl: row.selected_cover_url,
    promptVersion: row.prompt_version,
    qualityWarnings: row.quality_warnings,
    feedbackRating: row.feedback_rating,
    feedbackAt: row.feedback_at,
    feedbackHistoryId: row.feedback_history_id,
    updatedAt: row.updated_at,
  });
}

export async function getProfileGuideFlyerStudio(
  userId: string,
  guideId: string
): Promise<FlyerStudioPersistedState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_guide_flyer_studio")
    .select("*")
    .eq("guide_id", guideId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("profile_guide_flyer_studio")) return null;
    throw new Error(formatFlyerStudioError(error.message));
  }

  if (!data) return null;

  const { data: guide, error: guideError } = await supabase
    .from("profile_guides")
    .select("id")
    .eq("id", guideId)
    .eq("user_id", userId)
    .maybeSingle();

  if (guideError) throw new Error(formatFlyerStudioError(guideError.message));
  if (!guide) return null;

  return rowToFlyerStudioState(data as Record<string, unknown>);
}

export async function saveProfileGuideFlyerStudio(
  guideId: string,
  state: FlyerStudioPersistedState
): Promise<void> {
  if (!state.preview && !state.studioCache) return;

  const supabase = await createClient();
  const { error } = await supabase.from("profile_guide_flyer_studio").upsert(
    {
      guide_id: guideId,
      template: state.template,
      format: state.format,
      prompt_refinement: state.promptRefinement,
      display_options: state.displayOptions,
      image_prompt: state.studioCache?.imagePrompt ?? null,
      copy: state.studioCache?.copy ?? null,
      preview_url: state.preview,
      background_url: state.studioCache?.backgroundDataUrl ?? null,
      history: state.history,
      selected_history_id: state.selectedHistoryId,
      archetype: state.archetype,
      archetype_override: state.archetypeOverride,
      selected_cover_url: state.selectedCoverUrl,
      prompt_version: state.promptVersion,
      quality_warnings: state.qualityWarnings,
      feedback_rating: state.feedbackRating,
      feedback_at: state.feedbackAt,
      feedback_history_id: state.feedbackHistoryId,
      updated_at: state.updatedAt,
    },
    { onConflict: "guide_id" }
  );

  if (error) throw new Error(formatFlyerStudioError(error.message));
}

export function appendFlyerHistoryEntry(input: {
  existing: FlyerStudioPersistedState | null;
  imageDataUrl: string;
  template: string;
  format: string;
  recomposedOnly: boolean;
  promptVersion?: string;
}): Pick<FlyerStudioPersistedState, "history" | "selectedHistoryId"> {
  if (input.recomposedOnly) {
    return {
      history: input.existing?.history ?? [],
      selectedHistoryId: input.existing?.selectedHistoryId ?? null,
    };
  }

  const entry: FlyerHistoryEntry = {
    id: crypto.randomUUID(),
    imageDataUrl: input.imageDataUrl,
    label: `${input.template} · ${FLYER_FORMAT_SPECS[parseProfileGuideFlyerFormat(input.format)].label}`,
    template: input.template,
    format: input.format,
    createdAt: new Date().toISOString(),
    promptVersion: input.promptVersion ?? FLYER_PROMPT_VERSION,
  };

  return {
    history: [entry, ...(input.existing?.history ?? [])].slice(0, MAX_FLYER_HISTORY),
    selectedHistoryId: entry.id,
  };
}

export async function saveProfileGuideFlyerFeedback(input: {
  userId: string;
  guideId: string;
  businessId: string;
  rating: -1 | 1;
  historyId?: string | null;
  archetype?: string | null;
  format?: string | null;
  promptVersion?: string | null;
}): Promise<FlyerStudioPersistedState | null> {
  const existing = await getProfileGuideFlyerStudio(input.userId, input.guideId);
  if (!existing) return null;

  const updatedAt = new Date().toISOString();
  const nextState: FlyerStudioPersistedState = {
    ...existing,
    feedbackRating: input.rating,
    feedbackAt: updatedAt,
    feedbackHistoryId: input.historyId ?? existing.selectedHistoryId,
    updatedAt,
  };

  await saveProfileGuideFlyerStudio(input.guideId, nextState);

  logFlyerEvent({
    name: "flyer_feedback",
    guideId: input.guideId,
    businessId: input.businessId,
    rating: input.rating,
    historyId: nextState.feedbackHistoryId,
    archetype: input.archetype ?? existing.archetype,
    format: input.format ?? existing.format,
    promptVersion: input.promptVersion ?? existing.promptVersion,
  });

  return nextState;
}

export function serializeFlyerStudioForClient(state: FlyerStudioPersistedState | null) {
  if (!state) return null;

  return {
    template: state.template,
    format: state.format,
    promptRefinement: state.promptRefinement,
    displayOptions: state.displayOptions,
    preview: state.preview,
    studioCache: state.studioCache,
    history: state.history,
    selectedHistoryId: state.selectedHistoryId,
    archetype: state.archetype,
    archetypeOverride: state.archetypeOverride,
    selectedCoverUrl: state.selectedCoverUrl,
    promptVersion: state.promptVersion,
    qualityWarnings: state.qualityWarnings,
    feedbackRating: state.feedbackRating,
    feedbackAt: state.feedbackAt,
    feedbackHistoryId: state.feedbackHistoryId,
    updatedAt: state.updatedAt,
  };
}
