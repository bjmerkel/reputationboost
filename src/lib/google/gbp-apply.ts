import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import { recommendAttributeUpdates } from "./gbp-attribute-recommendations";
import type { BusinessHours } from "./gbp-hours";
import {
  defaultUsHolidayHours,
  defaultWeekdayHours,
  mergeSpecialHours,
} from "./gbp-hours";
import {
  getGbpLocationProfile,
  getGoogleUpdatedLocation,
  getLocationAttributes,
  listAvailableAttributes,
  patchGbpLocation,
  resolveCategoryByDisplayName,
  updateLocationAttributes,
  type GbpAttributeUpdate,
  type GbpCategoryRef,
} from "./gbp-location";
import {
  createGbpMediaFromUrl,
  extractPublicMediaUrl,
  uploadGbpMediaFile,
  type GbpMediaCategory,
  type GbpMediaFormat,
} from "./gbp-media";
import {
  applyReviewReply as postReviewReply,
  deleteReviewReply,
  formatPolicyViolation,
  formatReplyState,
} from "./gbp-reviews";

export interface GbpApplyResult {
  success: boolean;
  message: string;
  applied?: Record<string, unknown>;
}

async function mergeCategories(
  connection: GbpConnection,
  primaryDisplayName: string | undefined,
  additionalDisplayNames: string[]
): Promise<{ primaryCategory: GbpCategoryRef; additionalCategories: GbpCategoryRef[] }> {
  const current = await getGbpLocationProfile(connection);

  const primary = primaryDisplayName
    ? await resolveCategoryByDisplayName(connection, primaryDisplayName)
    : current.primaryCategory;

  if (!primary) {
    throw new Error("No primary category set. Choose a primary category first.");
  }

  const existingAdditional = current.additionalCategories;
  const resolvedAdditional: GbpCategoryRef[] = [];

  for (const name of additionalDisplayNames) {
    const cleaned = name
      .replace(/\(Primary\)/i, "")
      .replace(/\(if applicable\)/i, "")
      .replace(/\(only if applicable\)/i, "")
      .trim();
    if (!cleaned || cleaned.toLowerCase().includes("primary")) continue;
    try {
      const cat = await resolveCategoryByDisplayName(connection, cleaned);
      if (
        cat.name !== primary.name &&
        !resolvedAdditional.some((c) => c.name === cat.name)
      ) {
        resolvedAdditional.push(cat);
      }
    } catch {
      // Skip categories Google doesn't recognize
    }
  }

  const merged = [...existingAdditional];
  for (const cat of resolvedAdditional) {
    if (cat.name !== primary.name && !merged.some((c) => c.name === cat.name)) {
      merged.push(cat);
    }
  }

  return { primaryCategory: primary, additionalCategories: merged };
}

export async function applyPrimaryCategory(
  connection: GbpConnection,
  displayName: string
): Promise<GbpApplyResult> {
  const { primaryCategory, additionalCategories } = await mergeCategories(
    connection,
    displayName,
    []
  );

  await patchGbpLocation(connection, "categories", {
    categories: {
      primaryCategory: { name: primaryCategory.name },
      additionalCategories: additionalCategories.map((c) => ({ name: c.name })),
    },
  });

  return {
    success: true,
    message: `Primary category set to "${primaryCategory.displayName}"`,
    applied: { primaryCategory: primaryCategory.displayName },
  };
}

export async function applySecondaryCategories(
  connection: GbpConnection,
  displayNames: string[]
): Promise<GbpApplyResult> {
  const { primaryCategory, additionalCategories } = await mergeCategories(
    connection,
    undefined,
    displayNames
  );

  await patchGbpLocation(connection, "categories", {
    categories: {
      primaryCategory: { name: primaryCategory.name },
      additionalCategories: additionalCategories.map((c) => ({ name: c.name })),
    },
  });

  const added = additionalCategories.map((c) => c.displayName);
  return {
    success: true,
    message: `Updated categories. ${added.length} additional categor${added.length === 1 ? "y" : "ies"} on profile.`,
    applied: {
      primaryCategory: primaryCategory.displayName,
      additionalCategories: added,
    },
  };
}

export async function applyDescription(
  connection: GbpConnection,
  description: string
): Promise<GbpApplyResult> {
  const trimmed = description.trim();
  if (!trimmed) throw new Error("Description cannot be empty.");

  await patchGbpLocation(connection, "profile.description", {
    profile: { description: trimmed },
  });

  return {
    success: true,
    message: "Business description updated on Google Business Profile.",
    applied: { descriptionLength: trimmed.length },
  };
}

export async function applyTitle(
  connection: GbpConnection,
  title: string
): Promise<GbpApplyResult> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Business name cannot be empty.");

  await patchGbpLocation(connection, "title", { title: trimmed });

  return {
    success: true,
    message: "Business name updated on Google Business Profile.",
    applied: { title: trimmed },
  };
}

export async function applyWebsite(
  connection: GbpConnection,
  websiteUri: string
): Promise<GbpApplyResult> {
  const trimmed = websiteUri.trim();
  if (!trimmed) throw new Error("Website URL cannot be empty.");

  await patchGbpLocation(connection, "websiteUri", { websiteUri: trimmed });

  return {
    success: true,
    message: "Website URL updated on Google Business Profile.",
    applied: { websiteUri: trimmed },
  };
}

export async function applyPhone(
  connection: GbpConnection,
  primaryPhone: string
): Promise<GbpApplyResult> {
  const trimmed = primaryPhone.trim();
  if (!trimmed) throw new Error("Phone number cannot be empty.");

  const current = await getGbpLocationProfile(connection);

  await patchGbpLocation(connection, "phoneNumbers", {
    phoneNumbers: {
      primaryPhone: trimmed,
      additionalPhones: current.additionalPhones,
    },
  });

  return {
    success: true,
    message: "Phone number updated on Google Business Profile.",
    applied: { primaryPhone: trimmed },
  };
}

function buildFreeFormServiceItem(
  categoryName: string,
  name: string,
  description: string
): Record<string, unknown> {
  return {
    freeFormServiceItem: {
      category: categoryName,
      label: {
        displayName: name.slice(0, 140),
        description: description.slice(0, 250),
        languageCode: "en",
      },
    },
  };
}

export async function applyServiceItem(
  connection: GbpConnection,
  serviceName: string,
  serviceDescription: string
): Promise<GbpApplyResult> {
  const name = serviceName.trim();
  const description = serviceDescription.trim();
  if (!name) throw new Error("Service name is required.");

  const current = await getGbpLocationProfile(connection);
  if (!current.primaryCategory?.name) {
    throw new Error("Set a primary category before adding services.");
  }

  const exists = current.serviceItems.some(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    return {
      success: true,
      message: `Service "${name}" is already on your profile.`,
      applied: { serviceName: name, skipped: true },
    };
  }

  const serviceItems = [
    ...current.serviceItems.map((s) =>
      buildFreeFormServiceItem(current.primaryCategory!.name, s.name, s.description)
    ),
    buildFreeFormServiceItem(current.primaryCategory.name, name, description),
  ];

  await patchGbpLocation(connection, "serviceItems", { serviceItems });

  return {
    success: true,
    message: `Added service "${name}" to your Google Business Profile.`,
    applied: { serviceName: name },
  };
}

export async function applyAttributes(
  connection: GbpConnection,
  updates: GbpAttributeUpdate[]
): Promise<GbpApplyResult> {
  if (updates.length === 0) {
    throw new Error("No attribute updates provided.");
  }

  await updateLocationAttributes(connection, updates);

  return {
    success: true,
    message: `Updated ${updates.length} attribute(s) on Google Business Profile.`,
    applied: { count: updates.length },
  };
}

/** Enable BOOL attributes that are available but not yet set on the profile. */
export async function applyRecommendedAttributes(
  connection: GbpConnection,
  limit = 12
): Promise<GbpApplyResult> {
  const [available, current, profile] = await Promise.all([
    listAvailableAttributes(connection),
    getLocationAttributes(connection),
    getGbpLocationProfile(connection),
  ]);

  const updates = recommendAttributeUpdates(available, current, {
    websiteUri: profile.website,
    limit,
  });

  if (updates.length === 0) {
    return {
      success: true,
      message: "No additional attributes were available to enable.",
      applied: { count: 0 },
    };
  }

  await updateLocationAttributes(connection, updates);

  return {
    success: true,
    message: `Enabled ${updates.length} business attribute(s) on Google.`,
    applied: {
      count: updates.length,
      attributes: updates.map((u) => u.name),
    },
  };
}

export async function applyRegularHours(
  connection: GbpConnection,
  regularHours?: BusinessHours
): Promise<GbpApplyResult> {
  const hours = regularHours ?? defaultWeekdayHours();

  await patchGbpLocation(connection, "regularHours", { regularHours: hours });

  return {
    success: true,
    message: "Regular business hours updated on Google Business Profile.",
    applied: { periodCount: hours.periods?.length ?? 0 },
  };
}

export async function applyHolidayHours(
  connection: GbpConnection
): Promise<GbpApplyResult> {
  const current = await getGbpLocationProfile(connection);

  if (!current.hasRegularHours && !current.regularHours?.periods?.length) {
    await applyRegularHours(connection, defaultWeekdayHours());
  }

  const refreshed = await getGbpLocationProfile(connection);
  const holidays = mergeSpecialHours(
    refreshed.specialHours,
    defaultUsHolidayHours()
  );

  await patchGbpLocation(connection, "specialHours", { specialHours: holidays });

  return {
    success: true,
    message: "Holiday and special hours added to your Google Business Profile.",
    applied: { periodCount: holidays.specialHourPeriods?.length ?? 0 },
  };
}

export async function applyGoogleSuggestion(
  connection: GbpConnection,
  field: string
): Promise<GbpApplyResult> {
  const [profile, googleUpdated] = await Promise.all([
    getGbpLocationProfile(connection),
    getGoogleUpdatedLocation(connection),
  ]);

  const googleLocation = googleUpdated as Record<string, unknown>;

  switch (field) {
    case "title":
      await patchGbpLocation(connection, "title", { title: googleLocation.title });
      break;
    case "profile.description": {
      const desc = (googleLocation.profile as { description?: string } | undefined)?.description;
      if (!desc) throw new Error("No Google suggestion for description.");
      await patchGbpLocation(connection, "profile.description", { profile: { description: desc } });
      break;
    }
    case "phoneNumbers.primaryPhone": {
      const phone = (googleLocation.phoneNumbers as { primaryPhone?: string } | undefined)
        ?.primaryPhone;
      if (!phone) throw new Error("No Google suggestion for phone.");
      await patchGbpLocation(connection, "phoneNumbers", {
        phoneNumbers: { primaryPhone: phone, additionalPhones: profile.additionalPhones },
      });
      break;
    }
    case "websiteUri":
      if (!googleLocation.websiteUri) throw new Error("No Google suggestion for website.");
      await patchGbpLocation(connection, "websiteUri", {
        websiteUri: googleLocation.websiteUri,
      });
      break;
    case "regularHours":
      if (!googleLocation.regularHours) throw new Error("No Google suggestion for hours.");
      await patchGbpLocation(connection, "regularHours", {
        regularHours: googleLocation.regularHours,
      });
      break;
    case "specialHours":
      if (!googleLocation.specialHours) throw new Error("No Google suggestion for holiday hours.");
      await patchGbpLocation(connection, "specialHours", {
        specialHours: googleLocation.specialHours,
      });
      break;
    default:
      throw new Error(`Unsupported Google suggestion field: ${field}`);
  }

  return {
    success: true,
    message: `Accepted Google's suggested update for ${field}.`,
    applied: { field },
  };
}

export async function applyGooglePost(
  connection: GbpConnection,
  summary: string
): Promise<GbpApplyResult> {
  const trimmed = summary.trim();
  if (!trimmed) throw new Error("Post content cannot be empty.");

  const url = `https://mybusiness.googleapis.com/v4/accounts/${connection.accountId}/locations/${connection.locationId}/localPosts`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      languageCode: "en",
      summary: trimmed,
      topicType: "STANDARD",
      callToAction: {
        actionType: "CALL",
      },
    }),
  });

  const data = (await res.json()) as { name?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Failed to create Google Post (${res.status})`);
  }

  return {
    success: true,
    message: "Google Post published to your Business Profile.",
    applied: { postId: data.name },
  };
}

export async function applyMediaUpload(
  connection: GbpConnection,
  options: {
    sourceUrl: string;
    mediaFormat: GbpMediaFormat;
    category: GbpMediaCategory;
    description?: string;
  }
): Promise<GbpApplyResult> {
  const item = await createGbpMediaFromUrl(connection, options);
  const kind = options.mediaFormat === "VIDEO" ? "Video" : "Photo";

  return {
    success: true,
    message: `${kind} uploaded to your Google Business Profile (${options.category}).`,
    applied: {
      mediaName: item.name,
      googleUrl: item.googleUrl,
      category: options.category,
      mediaFormat: options.mediaFormat,
    },
  };
}

export async function applyMediaFromBytes(
  connection: GbpConnection,
  bytes: ArrayBuffer,
  contentType: string,
  options: {
    mediaFormat: GbpMediaFormat;
    category: GbpMediaCategory;
    description?: string;
  }
): Promise<GbpApplyResult> {
  const item = await uploadGbpMediaFile(
    connection,
    { bytes, contentType },
    options
  );
  const kind = options.mediaFormat === "VIDEO" ? "Video" : "Photo";

  return {
    success: true,
    message: `AI ${kind.toLowerCase()} uploaded to your Google Business Profile (${options.category}).`,
    applied: {
      mediaName: item.name,
      googleUrl: item.googleUrl,
      category: options.category,
      mediaFormat: options.mediaFormat,
      aiGenerated: true,
    },
  };
}

export async function applyMediaFromDraft(
  connection: GbpConnection,
  draftContent: string,
  payload: {
    sourceUrl?: string;
    mediaFormat?: GbpMediaFormat;
    category?: GbpMediaCategory;
    description?: string;
  }
): Promise<GbpApplyResult> {
  const sourceUrl =
    payload.sourceUrl?.trim() || extractPublicMediaUrl(draftContent) || "";
  if (!sourceUrl) {
    throw new Error(
      "Add a public image or video URL to the draft (https://…) before running this task."
    );
  }

  const mediaFormat = payload.mediaFormat ?? "PHOTO";
  const category = payload.category ?? "ADDITIONAL";
  const description =
    payload.description ??
    draftContent
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("http") && !l.startsWith("Category:"))
      ?.slice(0, 500);

  return applyMediaUpload(connection, {
    sourceUrl,
    mediaFormat,
    category,
    description,
  });
}

export async function applyReviewReply(
  connection: GbpConnection,
  reviewId: string,
  comment: string
): Promise<GbpApplyResult> {
  const result = await postReviewReply(connection, reviewId, comment);
  const stateLabel = formatReplyState(result.reviewReplyState);
  const violation = formatPolicyViolation(result.policyViolation);

  let message = `Review response submitted (${stateLabel}).`;
  if (result.reviewReplyState === "REJECTED" && violation) {
    message = `Reply was rejected: ${violation}. Edit and try again.`;
  } else if (result.reviewReplyState === "PENDING") {
    message = "Reply submitted — Google is reviewing it before it goes live.";
  }

  return {
    success: result.reviewReplyState !== "REJECTED",
    message,
    applied: {
      reviewId: result.reviewId,
      reviewReplyState: result.reviewReplyState,
      policyViolation: result.policyViolation,
      updateTime: result.updateTime,
    },
  };
}

export async function applyDeleteReviewReply(
  connection: GbpConnection,
  reviewId: string
): Promise<GbpApplyResult> {
  await deleteReviewReply(connection, reviewId);

  return {
    success: true,
    message: "Review reply removed from Google.",
    applied: { reviewId },
  };
}

export type GbpApplyAction =
  | "update_primary_category"
  | "add_secondary_categories"
  | "update_description"
  | "update_title"
  | "update_website"
  | "update_phone"
  | "add_service_item"
  | "update_attributes"
  | "enable_recommended_attributes"
  | "update_regular_hours"
  | "update_holiday_hours"
  | "accept_google_suggestion"
  | "upload_media"
  | "create_post"
  | "reply_review"
  | "delete_review_reply";

export async function applyGbpAction(
  connection: GbpConnection,
  action: GbpApplyAction,
  payload: {
    primaryCategory?: string;
    secondaryCategories?: string[];
    description?: string;
    title?: string;
    websiteUri?: string;
    primaryPhone?: string;
    serviceName?: string;
    serviceDescription?: string;
    attributes?: GbpAttributeUpdate[];
    sourceUrl?: string;
    mediaFormat?: GbpMediaFormat;
    category?: GbpMediaCategory;
    postSummary?: string;
    reviewId?: string;
    reviewReply?: string;
    suggestionField?: string;
    regularHours?: BusinessHours;
  }
): Promise<GbpApplyResult> {
  switch (action) {
    case "update_primary_category":
      if (!payload.primaryCategory) throw new Error("primaryCategory is required");
      return applyPrimaryCategory(connection, payload.primaryCategory);
    case "add_secondary_categories":
      return applySecondaryCategories(connection, payload.secondaryCategories ?? []);
    case "update_description":
      if (!payload.description) throw new Error("description is required");
      return applyDescription(connection, payload.description);
    case "update_title":
      if (!payload.title) throw new Error("title is required");
      return applyTitle(connection, payload.title);
    case "update_website":
      if (!payload.websiteUri) throw new Error("websiteUri is required");
      return applyWebsite(connection, payload.websiteUri);
    case "update_phone":
      if (!payload.primaryPhone) throw new Error("primaryPhone is required");
      return applyPhone(connection, payload.primaryPhone);
    case "add_service_item":
      if (!payload.serviceName) throw new Error("serviceName is required");
      return applyServiceItem(
        connection,
        payload.serviceName,
        payload.serviceDescription ?? ""
      );
    case "update_attributes":
      if (!payload.attributes?.length) throw new Error("attributes are required");
      return applyAttributes(connection, payload.attributes);
    case "enable_recommended_attributes":
      return applyRecommendedAttributes(connection);
    case "update_regular_hours":
      return applyRegularHours(connection, payload.regularHours);
    case "update_holiday_hours":
      return applyHolidayHours(connection);
    case "accept_google_suggestion":
      if (!payload.suggestionField) throw new Error("suggestionField is required");
      return applyGoogleSuggestion(connection, payload.suggestionField);
    case "upload_media":
      if (!payload.sourceUrl) throw new Error("sourceUrl is required");
      return applyMediaUpload(connection, {
        sourceUrl: payload.sourceUrl,
        mediaFormat: payload.mediaFormat ?? "PHOTO",
        category: payload.category ?? "ADDITIONAL",
        description: payload.description,
      });
    case "create_post":
      if (!payload.postSummary) throw new Error("postSummary is required");
      return applyGooglePost(connection, payload.postSummary);
    case "reply_review":
      if (!payload.reviewId || !payload.reviewReply) {
        throw new Error("reviewId and reviewReply are required");
      }
      return applyReviewReply(connection, payload.reviewId, payload.reviewReply);
    case "delete_review_reply":
      if (!payload.reviewId) throw new Error("reviewId is required");
      return applyDeleteReviewReply(connection, payload.reviewId);
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
