import {
  DEFAULT_FLYER_DISPLAY_OPTIONS,
  parseFlyerDisplayOptions,
  type FlyerDisplayOptions,
} from "./options";
import {
  parseProfileGuideFlyerFormat,
  type ProfileGuideFlyerFormat,
} from "./formats";
import { PROFILE_GUIDE_FLYER_TEMPLATES } from "../theme";

export interface FlyerCopyPayload {
  headline: string;
  subhead: string;
  cta: string;
  qrLabel: string;
  supportLine: string;
}

export interface FlyerStudioCache {
  backgroundDataUrl: string;
  imagePrompt: string;
  copy: FlyerCopyPayload;
}

export interface FlyerHistoryEntry {
  id: string;
  imageDataUrl: string;
  label: string;
  template: string;
  format: string;
  createdAt: string;
}

export interface FlyerStudioPersistedState {
  version: 1;
  template: (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number];
  format: ProfileGuideFlyerFormat;
  promptRefinement: string;
  displayOptions: FlyerDisplayOptions;
  preview: string | null;
  studioCache: FlyerStudioCache | null;
  history: FlyerHistoryEntry[];
  selectedHistoryId: string | null;
  updatedAt: string;
}

function isDataImageUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function parseCopy(value: unknown): FlyerCopyPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.headline !== "string" ||
    typeof record.subhead !== "string" ||
    typeof record.cta !== "string"
  ) {
    return null;
  }

  return {
    headline: record.headline,
    subhead: record.subhead,
    cta: record.cta,
    qrLabel: typeof record.qrLabel === "string" ? record.qrLabel : "Scan to leave a Google review",
    supportLine: typeof record.supportLine === "string" ? record.supportLine : "",
  };
}

function parseStudioCache(value: unknown): FlyerStudioCache | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const copy = parseCopy(record.copy);
  if (
    !isDataImageUrl(record.backgroundDataUrl) ||
    typeof record.imagePrompt !== "string" ||
    !copy
  ) {
    return null;
  }

  return {
    backgroundDataUrl: record.backgroundDataUrl,
    imagePrompt: record.imagePrompt,
    copy,
  };
}

function parseHistoryEntry(value: unknown): FlyerHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !isDataImageUrl(record.imageDataUrl) ||
    typeof record.label !== "string" ||
    typeof record.template !== "string" ||
    typeof record.format !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    imageDataUrl: record.imageDataUrl,
    label: record.label,
    template: record.template,
    format: record.format,
    createdAt: record.createdAt,
  };
}

function parseTemplate(value: unknown): (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number] {
  if (
    typeof value === "string" &&
    PROFILE_GUIDE_FLYER_TEMPLATES.includes(value as (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number])
  ) {
    return value as (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number];
  }
  return "professional";
}

export function parseFlyerStudioState(value: unknown): FlyerStudioPersistedState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Record<string, unknown>;
  if (parsed.version !== 1) return null;

  const preview =
    parsed.preview == null ? null : isDataImageUrl(parsed.preview) ? parsed.preview : null;
  const studioCache = parseStudioCache(parsed.studioCache);
  const history = Array.isArray(parsed.history)
    ? parsed.history
        .map(parseHistoryEntry)
        .filter((entry): entry is FlyerHistoryEntry => entry !== null)
    : [];

  if (!preview && !studioCache) return null;

  return {
    version: 1,
    template: parseTemplate(parsed.template),
    format: parseProfileGuideFlyerFormat(
      typeof parsed.format === "string" ? parsed.format : "letter"
    ),
    promptRefinement: typeof parsed.promptRefinement === "string" ? parsed.promptRefinement : "",
    displayOptions: parseFlyerDisplayOptions(parsed.displayOptions ?? DEFAULT_FLYER_DISPLAY_OPTIONS),
    preview,
    studioCache,
    history,
    selectedHistoryId:
      typeof parsed.selectedHistoryId === "string" ? parsed.selectedHistoryId : null,
    updatedAt:
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
  };
}
