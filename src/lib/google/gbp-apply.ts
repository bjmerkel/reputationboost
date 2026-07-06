import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import { recommendAttributeUpdates, recommendBookingAttributes } from "./gbp-attribute-recommendations";
import type { BusinessHours } from "./gbp-hours";
import {
  defaultUsHolidayHours,
  defaultWeekdayHours,
  mergeSpecialHours,
} from "./gbp-hours";
import {
  attributeApiToUpdate,
  getGbpLocationProfile,
  getGoogleUpdatedAttributes,
  getGoogleUpdatedSnapshot,
  getLocationAttributes,
  listAvailableAttributes,
  lookupServiceTypeForDisplayName,
  resolveCategoryByDisplayName,
  updateLocationAttributes,
  type GbpAttributeUpdate,
  type GbpCategoryRef,
} from "./gbp-location";
import {
  ATTRIBUTE_SUGGESTION_PREFIX,
  fieldLabel,
  isGoogleUpdateResolved,
  maskIncludesField,
} from "./gbp-google-updated";
import {
  buildDescriptionApplyMessage,
  buildDescriptionSanitizeNote,
  descriptionsMatch,
  GBP_DESCRIPTION_MAX_LENGTH,
  sanitizeGbpDescriptionForPublish,
} from "./gbp-description";
import { patchGbpLocationValidated } from "./gbp-patch";
import type { NapCanonical, NapDriftFieldName } from "./nap-drift";
import {
  createGbpMediaFromUrl,
  deleteGbpMedia,
  extractPublicMediaUrl,
  patchGbpMediaCategory,
  uploadGbpMediaFile,
  type GbpMediaCategory,
  type GbpMediaFormat,
} from "./gbp-media";
import { createGbpLocalPost } from "./gbp-local-posts";
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

  await patchGbpLocationValidated(connection, "categories", {
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

  await patchGbpLocationValidated(connection, "categories", {
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
  const sanitized = sanitizeGbpDescriptionForPublish(description);
  const trimmed = sanitized.text;
  if (!trimmed) {
    throw new Error(
      "Description cannot be empty. Google does not allow URLs in descriptions — remove links and try again."
    );
  }
  if (trimmed.length > GBP_DESCRIPTION_MAX_LENGTH) {
    throw new Error(
      `Description is ${trimmed.length} characters. Google allows at most ${GBP_DESCRIPTION_MAX_LENGTH}.`
    );
  }

  const sanitizeNote = buildDescriptionSanitizeNote(sanitized);
  const snapshot = await getGoogleUpdatedSnapshot(connection).catch(() => ({
    location: {},
    diffMask: "",
    pendingMask: "",
  }));
  const descriptionConflict = maskIncludesField(snapshot.diffMask, "profile.description");

  if (descriptionConflict) {
    const conflictResult = await rejectGoogleSuggestion(
      connection,
      "profile.description",
      trimmed
    );
    if (!conflictResult.success) {
      return {
        ...conflictResult,
        message: sanitizeNote
          ? `${conflictResult.message} ${sanitizeNote}`
          : conflictResult.message,
      };
    }
  } else {
    await patchGbpLocationValidated(connection, "profile.description", {
      profile: { description: trimmed },
    });
  }

  const [live, refreshedSnapshot] = await Promise.all([
    getGbpLocationProfile(connection),
    getGoogleUpdatedSnapshot(connection).catch(() => ({
      location: {},
      diffMask: snapshot.diffMask,
      pendingMask: snapshot.pendingMask,
    })),
  ]);

  const descriptionProcessing = maskIncludesField(
    refreshedSnapshot.pendingMask,
    "profile.description"
  );
  const descriptionStillConflict = maskIncludesField(
    refreshedSnapshot.diffMask,
    "profile.description"
  );

  const verification = {
    verified: descriptionsMatch(trimmed, live.description),
    hasPendingEdits: live.hasPendingEdits,
    liveDescription: live.description,
    isProcessing: descriptionProcessing,
    hasDiff: descriptionStillConflict,
  };
  const outcome = buildDescriptionApplyMessage(verification, trimmed.length);
  const message = sanitizeNote ? `${outcome.message} ${sanitizeNote}` : outcome.message;

  return {
    success: outcome.success,
    message,
    applied: {
      descriptionLength: trimmed.length,
      liveDescriptionLength: live.description.length,
      verified: verification.verified,
      hasPendingEdits: live.hasPendingEdits,
      isProcessing: descriptionProcessing,
      hasDiff: descriptionStillConflict,
      diffMask: refreshedSnapshot.diffMask,
      pendingMask: refreshedSnapshot.pendingMask,
      resolvedConflict: descriptionConflict,
      sanitized: sanitized.removedUrls || sanitized.removedInvalidChars,
    },
  };
}

export async function applyTitle(
  connection: GbpConnection,
  title: string
): Promise<GbpApplyResult> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Business name cannot be empty.");

  await patchGbpLocationValidated(connection, "title", { title: trimmed });

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

  await patchGbpLocationValidated(connection, "websiteUri", { websiteUri: trimmed });

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

  await patchGbpLocationValidated(connection, "phoneNumbers", {
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

function buildStructuredServiceItem(serviceTypeId: string, description: string): Record<string, unknown> {
  return {
    structuredServiceItem: {
      serviceTypeId,
      description: description.slice(0, 300),
    },
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

function serviceItemForPatch(
  item: { name: string; description: string; raw?: Record<string, unknown> },
  categoryName: string
): Record<string, unknown> {
  if (item.raw) return item.raw;
  return buildFreeFormServiceItem(categoryName, item.name, item.description);
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

  const categoryName = current.primaryCategory.name;
  const structured = await lookupServiceTypeForDisplayName(connection, categoryName, name);
  const newServiceItem = structured
    ? buildStructuredServiceItem(structured.serviceTypeId, description)
    : buildFreeFormServiceItem(categoryName, name, description);

  const serviceItems = [
    ...current.serviceItems.map((s) => serviceItemForPatch(s, categoryName)),
    newServiceItem,
  ];

  await patchGbpLocationValidated(connection, "serviceItems", { serviceItems });

  return {
    success: true,
    message: structured
      ? `Added structured service "${structured.displayName}" to your Google Business Profile.`
      : `Added service "${name}" to your Google Business Profile.`,
    applied: {
      serviceName: structured?.displayName ?? name,
      structured: Boolean(structured),
    },
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

export async function applyBookingAttributes(
  connection: GbpConnection,
  bookingUri?: string
): Promise<GbpApplyResult> {
  const [available, current, profile] = await Promise.all([
    listAvailableAttributes(connection),
    getLocationAttributes(connection),
    getGbpLocationProfile(connection),
  ]);

  const uri = bookingUri?.trim() || profile.website;
  if (!uri) {
    throw new Error("No booking or website URL available to link.");
  }

  const updates = recommendBookingAttributes(available, current, uri);
  if (updates.length === 0) {
    return {
      success: true,
      message: "No booking or appointment attributes are available for this category.",
      applied: { count: 0 },
    };
  }

  await updateLocationAttributes(connection, updates);

  return {
    success: true,
    message: `Linked booking URL on ${updates.length} attribute(s).`,
    applied: { count: updates.length, bookingUri: uri },
  };
}

export async function applyStorefrontAddress(
  connection: GbpConnection,
  address: string
): Promise<GbpApplyResult> {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Address cannot be empty.");

  await patchGbpLocationValidated(connection, "storefrontAddress", {
    storefrontAddress: {
      addressLines: [trimmed],
      regionCode: "US",
    },
  });

  return {
    success: true,
    message: "Business address updated on Google Business Profile.",
    applied: { address: trimmed },
  };
}

export async function applySyncNapField(
  connection: GbpConnection,
  field: NapDriftFieldName,
  canonical: NapCanonical
): Promise<GbpApplyResult> {
  switch (field) {
    case "title":
      return applyTitle(connection, canonical.name);
    case "phone":
      return applyPhone(connection, canonical.phone);
    case "website":
      return applyWebsite(connection, canonical.website);
    case "address":
      return applyStorefrontAddress(connection, canonical.address);
    default:
      throw new Error(`Unsupported NAP field: ${field}`);
  }
}

export async function applyRegularHours(
  connection: GbpConnection,
  regularHours?: BusinessHours
): Promise<GbpApplyResult> {
  const hours = regularHours ?? defaultWeekdayHours();

  await patchGbpLocationValidated(connection, "regularHours", { regularHours: hours });

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

  await patchGbpLocationValidated(connection, "specialHours", { specialHours: holidays });

  return {
    success: true,
    message: "Holiday and special hours added to your Google Business Profile.",
    applied: { periodCount: holidays.specialHourPeriods?.length ?? 0 },
  };
}

export async function applyGoogleAttributeSuggestion(
  connection: GbpConnection,
  attributeName: string
): Promise<GbpApplyResult> {
  const googleRaw = await getGoogleUpdatedAttributes(connection);
  const googleAttributes = (googleRaw.attributes as Array<Record<string, unknown>> | undefined) ?? [];
  const match = googleAttributes.find((attr) => attr.name === attributeName);

  if (!match) {
    throw new Error(`No Google suggestion found for attribute ${attributeName}.`);
  }

  const update = attributeApiToUpdate(match as Parameters<typeof attributeApiToUpdate>[0]);
  if (!update) {
    throw new Error(`Could not apply Google suggestion for attribute ${attributeName}.`);
  }

  await updateLocationAttributes(connection, [update]);

  return {
    success: true,
    message: `Accepted Google's suggested attribute update.`,
    applied: { attributeName },
  };
}

async function verifyGoogleUpdateFieldResolved(
  connection: GbpConnection,
  field: string,
  action: "accepted" | "rejected"
): Promise<GbpApplyResult> {
  const [profile, snapshot] = await Promise.all([
    getGbpLocationProfile(connection),
    getGoogleUpdatedSnapshot(connection),
  ]);

  const label = fieldLabel(field);
  const stillInDiff = maskIncludesField(snapshot.diffMask, field);

  if (stillInDiff) {
    return {
      success: false,
      message: `Google still shows a conflict for ${label}. Check Business Profile Manager or try again.`,
      applied: {
        field,
        action,
        diffMask: snapshot.diffMask,
        pendingMask: snapshot.pendingMask,
      },
    };
  }

  const resolved = isGoogleUpdateResolved(snapshot.diffMask, profile.hasGoogleUpdated);
  const pendingNote = maskIncludesField(snapshot.pendingMask, field)
    ? ` ${label} is still processing on Google.`
    : "";

  return {
    success: true,
    message: resolved
      ? `${action === "accepted" ? "Accepted" : "Kept"} your ${label.toLowerCase()} — Google update resolved.${pendingNote}`
      : `${action === "accepted" ? "Accepted" : "Kept"} Google's update for ${label}.${pendingNote}`,
    applied: {
      field,
      action,
      diffMask: snapshot.diffMask,
      pendingMask: snapshot.pendingMask,
      resolved,
    },
  };
}

async function patchOwnerFieldValue(
  connection: GbpConnection,
  field: string,
  profile: Awaited<ReturnType<typeof getGbpLocationProfile>>,
  preferredValue?: string
): Promise<void> {
  switch (field) {
    case "title":
      await patchGbpLocationValidated(connection, "title", {
        title: preferredValue ?? profile.title,
      });
      break;
    case "profile.description":
      await patchGbpLocationValidated(connection, "profile.description", {
        profile: { description: preferredValue ?? profile.description },
      });
      break;
    case "phoneNumbers.primaryPhone":
      await patchGbpLocationValidated(connection, "phoneNumbers", {
        phoneNumbers: {
          primaryPhone: preferredValue ?? profile.phone,
          additionalPhones: profile.additionalPhones,
        },
      });
      break;
    case "websiteUri":
      await patchGbpLocationValidated(connection, "websiteUri", {
        websiteUri: preferredValue ?? profile.website,
      });
      break;
    case "regularHours":
      if (!profile.regularHours) throw new Error("No regular hours on profile to keep.");
      await patchGbpLocationValidated(connection, "regularHours", {
        regularHours: profile.regularHours,
      });
      break;
    case "specialHours":
      if (!profile.specialHours) throw new Error("No holiday hours on profile to keep.");
      await patchGbpLocationValidated(connection, "specialHours", {
        specialHours: profile.specialHours,
      });
      break;
    case "storefrontAddress":
      await patchGbpLocationValidated(connection, "storefrontAddress", {
        storefrontAddress: preferredValue
          ? { addressLines: [preferredValue], regionCode: "US" }
          : { addressLines: [profile.address], regionCode: "US" },
      });
      break;
    default:
      throw new Error(`Unsupported Google suggestion field: ${field}`);
  }
}

async function patchGoogleFieldValue(
  connection: GbpConnection,
  field: string,
  googleLocation: Record<string, unknown>,
  profile: Awaited<ReturnType<typeof getGbpLocationProfile>>
): Promise<void> {
  switch (field) {
    case "title":
      await patchGbpLocationValidated(connection, "title", { title: googleLocation.title });
      break;
    case "profile.description": {
      const desc = (googleLocation.profile as { description?: string } | undefined)?.description;
      if (!desc) throw new Error("No Google suggestion for description.");
      await patchGbpLocationValidated(connection, "profile.description", { profile: { description: desc } });
      break;
    }
    case "phoneNumbers.primaryPhone": {
      const phone = (googleLocation.phoneNumbers as { primaryPhone?: string } | undefined)
        ?.primaryPhone;
      if (!phone) throw new Error("No Google suggestion for phone.");
      await patchGbpLocationValidated(connection, "phoneNumbers", {
        phoneNumbers: { primaryPhone: phone, additionalPhones: profile.additionalPhones },
      });
      break;
    }
    case "websiteUri":
      if (!googleLocation.websiteUri) throw new Error("No Google suggestion for website.");
      await patchGbpLocationValidated(connection, "websiteUri", {
        websiteUri: googleLocation.websiteUri,
      });
      break;
    case "regularHours":
      if (!googleLocation.regularHours) throw new Error("No Google suggestion for hours.");
      await patchGbpLocationValidated(connection, "regularHours", {
        regularHours: googleLocation.regularHours,
      });
      break;
    case "specialHours":
      if (!googleLocation.specialHours) throw new Error("No Google suggestion for holiday hours.");
      await patchGbpLocationValidated(connection, "specialHours", {
        specialHours: googleLocation.specialHours,
      });
      break;
    case "storefrontAddress": {
      const addr = googleLocation.storefrontAddress;
      if (!addr) throw new Error("No Google suggestion for address.");
      await patchGbpLocationValidated(connection, "storefrontAddress", {
        storefrontAddress: addr,
      });
      break;
    }
    default:
      throw new Error(`Unsupported Google suggestion field: ${field}`);
  }
}

export async function applyGoogleSuggestion(
  connection: GbpConnection,
  field: string
): Promise<GbpApplyResult> {
  if (field.startsWith(ATTRIBUTE_SUGGESTION_PREFIX)) {
    const result = await applyGoogleAttributeSuggestion(
      connection,
      field.slice(ATTRIBUTE_SUGGESTION_PREFIX.length)
    );
    return result;
  }

  const [profile, snapshot] = await Promise.all([
    getGbpLocationProfile(connection),
    getGoogleUpdatedSnapshot(connection),
  ]);

  if (!maskIncludesField(snapshot.diffMask, field)) {
    throw new Error(`No Google update conflict for ${fieldLabel(field)}.`);
  }

  await patchGoogleFieldValue(connection, field, snapshot.location, profile);
  return verifyGoogleUpdateFieldResolved(connection, field, "accepted");
}

export async function rejectGoogleSuggestion(
  connection: GbpConnection,
  field: string,
  preferredValue?: string
): Promise<GbpApplyResult> {
  if (field.startsWith(ATTRIBUTE_SUGGESTION_PREFIX)) {
    throw new Error("Rejecting attribute suggestions is not supported yet.");
  }

  const [profile, snapshot] = await Promise.all([
    getGbpLocationProfile(connection),
    getGoogleUpdatedSnapshot(connection),
  ]);

  if (!maskIncludesField(snapshot.diffMask, field)) {
    throw new Error(`No Google update conflict for ${fieldLabel(field)}.`);
  }

  await patchOwnerFieldValue(connection, field, profile, preferredValue);
  return verifyGoogleUpdateFieldResolved(connection, field, "rejected");
}

export async function applyGooglePost(
  connection: GbpConnection,
  summary: string
): Promise<GbpApplyResult> {
  const post = await createGbpLocalPost(connection, {
    summary,
    topicType: "STANDARD",
    callToAction: { actionType: "CALL" },
  });

  return {
    success: true,
    message: "Google Post published to your Business Profile.",
    applied: { postId: post.name },
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

export async function applyMediaRecategorize(
  connection: GbpConnection,
  mediaName: string,
  category: GbpMediaCategory
): Promise<GbpApplyResult> {
  const item = await patchGbpMediaCategory(connection, mediaName, category);

  return {
    success: true,
    message: `Photo recategorized to ${category} on your Google Business Profile.`,
    applied: {
      mediaName: item.name,
      category: item.category,
      googleUrl: item.googleUrl,
    },
  };
}

export async function applyMediaDelete(
  connection: GbpConnection,
  mediaName: string
): Promise<GbpApplyResult> {
  await deleteGbpMedia(connection, mediaName);

  return {
    success: true,
    message: "Photo removed from your Google Business Profile.",
    applied: { mediaName, deleted: true },
  };
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
  | "reject_google_suggestion"
  | "sync_nap_field"
  | "update_booking_attributes"
  | "upload_media"
  | "recategorize_media"
  | "delete_media"
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
    preferredValue?: string;
    regularHours?: BusinessHours;
    napField?: NapDriftFieldName;
    napCanonical?: NapCanonical;
    bookingUri?: string;
    mediaName?: string;
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
    case "reject_google_suggestion":
      if (!payload.suggestionField) throw new Error("suggestionField is required");
      return rejectGoogleSuggestion(connection, payload.suggestionField, payload.preferredValue);
    case "sync_nap_field":
      if (!payload.napField || !payload.napCanonical) {
        throw new Error("napField and napCanonical are required");
      }
      return applySyncNapField(connection, payload.napField, payload.napCanonical);
    case "update_booking_attributes":
      return applyBookingAttributes(connection, payload.bookingUri);
    case "upload_media":
      if (!payload.sourceUrl) throw new Error("sourceUrl is required");
      return applyMediaUpload(connection, {
        sourceUrl: payload.sourceUrl,
        mediaFormat: payload.mediaFormat ?? "PHOTO",
        category: payload.category ?? "ADDITIONAL",
        description: payload.description,
      });
    case "recategorize_media":
      if (!payload.mediaName || !payload.category) {
        throw new Error("mediaName and category are required");
      }
      return applyMediaRecategorize(connection, payload.mediaName, payload.category);
    case "delete_media":
      if (!payload.mediaName) throw new Error("mediaName is required");
      return applyMediaDelete(connection, payload.mediaName);
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
