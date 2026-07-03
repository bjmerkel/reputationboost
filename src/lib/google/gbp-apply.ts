import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import {
  getGbpLocationProfile,
  patchGbpLocation,
  resolveCategoryByDisplayName,
  type GbpCategoryRef,
} from "./gbp-location";

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

export async function applyReviewReply(
  connection: GbpConnection,
  reviewId: string,
  comment: string
): Promise<GbpApplyResult> {
  const url = `https://mybusiness.googleapis.com/v4/accounts/${connection.accountId}/locations/${connection.locationId}/reviews/${reviewId}/reply`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: comment.trim() }),
  });

  const data = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Failed to post review reply (${res.status})`);
  }

  return {
    success: true,
    message: "Review response published on Google.",
    applied: { reviewId },
  };
}

export type GbpApplyAction =
  | "update_primary_category"
  | "add_secondary_categories"
  | "update_description"
  | "create_post"
  | "reply_review";

export async function applyGbpAction(
  connection: GbpConnection,
  action: GbpApplyAction,
  payload: {
    primaryCategory?: string;
    secondaryCategories?: string[];
    description?: string;
    postSummary?: string;
    reviewId?: string;
    reviewReply?: string;
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
    case "create_post":
      if (!payload.postSummary) throw new Error("postSummary is required");
      return applyGooglePost(connection, payload.postSummary);
    case "reply_review":
      if (!payload.reviewId || !payload.reviewReply) {
        throw new Error("reviewId and reviewReply are required");
      }
      return applyReviewReply(connection, payload.reviewId, payload.reviewReply);
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
