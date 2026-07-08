import type {
  GbpAttributeCoverage,
  GbpGoogleUpdateState,
  GbpLocationInventory,
  GbpLocationInventoryField,
  GbpLocationFieldStatus,
  GbpSnapshot,
} from "@/audit/types";
import { isProfileLinkCoverageItem, isUriAttributeType, resolveProfileLinkMissing } from "./gbp-attribute-recommendations";
import { enrichLocationInventoryScores } from "./gbp-field-score-impact";
import { GBP_DESCRIPTION_MAX_LENGTH } from "./gbp-description";
import { missingServiceKeywords } from "./gbp-service-descriptions";
import type { GbpLocationProfile } from "./gbp-location";
import { maskIncludesField } from "./gbp-google-updated";
import {
  formatRegularHoursSummary,
  formatSpecialHoursSummary,
  hasAdequateHolidayCoverage,
  hasSpecialHourPeriods,
} from "./gbp-hours";

export interface BuildGbpLocationInventoryInput {
  collectedAt: string;
  source: "oauth" | "places" | "mixed";
  profile: GbpLocationProfile | null;
  identity: GbpSnapshot["identity"];
  completeness: GbpSnapshot["completeness"];
  content: GbpSnapshot["content"];
  engagement: GbpSnapshot["engagement"];
  performance: GbpSnapshot["performance"];
  issues: GbpSnapshot["issues"];
  googleUpdateState?: GbpGoogleUpdateState;
  liveProfile?: GbpSnapshot["liveProfile"];
  monthlyActions?: number;
  avgCustomerValue?: number | null;
  attributeCoverage?: GbpAttributeCoverage;
  /** Target ranking keywords — used to judge whether services cover keyword gaps. */
  targetKeywords?: string[];
}

function fieldStatus(
  present: boolean,
  good: boolean,
  options?: { conflict?: boolean; processing?: boolean; blocked?: boolean }
): GbpLocationFieldStatus {
  if (options?.blocked) return "blocked";
  if (options?.conflict) return "conflict";
  if (options?.processing) return "processing";
  if (!present) return "missing";
  return good ? "good" : "needs_work";
}

function googleFieldState(
  apiPath: string,
  googleUpdateState?: GbpGoogleUpdateState
): { hasConflict: boolean; isProcessing: boolean } {
  const diffMask = googleUpdateState?.diffMask ?? "";
  const pendingMask = googleUpdateState?.pendingMask ?? "";
  return {
    hasConflict: maskIncludesField(diffMask, apiPath),
    isProcessing: maskIncludesField(pendingMask, apiPath),
  };
}

function inventoryField(
  partial: Omit<GbpLocationInventoryField, "hasConflict" | "isProcessing"> & {
    apiPath: string;
    googleUpdateState?: GbpGoogleUpdateState;
  }
): GbpLocationInventoryField {
  const { googleUpdateState, apiPath, status, ...rest } = partial;
  const conflictState = googleFieldState(apiPath, googleUpdateState);
  const resolvedStatus =
    conflictState.hasConflict
      ? "conflict"
      : conflictState.isProcessing && status !== "missing"
        ? "processing"
        : status;

  return {
    ...rest,
    apiPath,
    status: resolvedStatus,
    hasConflict: conflictState.hasConflict,
    isProcessing: conflictState.isProcessing,
  };
}

function summarize(fields: GbpLocationInventoryField[]): GbpLocationInventory["summary"] {
  const summary = {
    total: fields.length,
    good: 0,
    needsWork: 0,
    missing: 0,
    conflict: 0,
    processing: 0,
    blocked: 0,
  };

  for (const field of fields) {
    switch (field.status) {
      case "good":
        summary.good += 1;
        break;
      case "needs_work":
        summary.needsWork += 1;
        break;
      case "missing":
        summary.missing += 1;
        break;
      case "conflict":
        summary.conflict += 1;
        break;
      case "processing":
        summary.processing += 1;
        break;
      case "blocked":
        summary.blocked += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

function buildAttributesInventoryField(
  attributes: string[],
  attributeCoverage: GbpAttributeCoverage | undefined,
  completeness: GbpSnapshot["completeness"]
): Pick<GbpLocationInventoryField, "current" | "status" | "constraint" | "missingCurrent"> {
  if (attributeCoverage && attributeCoverage.availableCount > 0) {
    const { enabledCount, availableCount, enabled, missing, missingCount } = attributeCoverage;
    const autoMissingCount = missing.filter((item) => item.autoApplicable).length;
    const uriMissingCount = resolveProfileLinkMissing(attributeCoverage).length;
    const enumMissingCount = missing.filter(
      (item) =>
        !item.autoApplicable &&
        !isProfileLinkCoverageItem(item) &&
        !isUriAttributeType(item.valueType)
    ).length;

    const current =
      enabledCount > 0
        ? `${enabledCount} of ${availableCount} enabled: ${enabled
            .slice(0, 5)
            .map((item) => item.displayName)
            .join(", ")}${enabledCount > 5 ? "…" : ""}`
        : `0 of ${availableCount} enabled`;

    const missingCurrent =
      missingCount > 0
        ? `Not enabled (${missingCount}): ${missing
            .slice(0, 10)
            .map((item) => item.displayName)
            .join(", ")}${missingCount > 10 ? "…" : ""}`
        : undefined;

    const constraint =
      missingCount > 0
        ? autoMissingCount > 0 && uriMissingCount > 0 && enumMissingCount > 0
          ? `${autoMissingCount} can be enabled · ${uriMissingCount} links to add · ${enumMissingCount} need manual setup in Google`
          : autoMissingCount > 0 && uriMissingCount > 0
            ? `${autoMissingCount} can be enabled · ${uriMissingCount} links to add from your plan`
            : autoMissingCount > 0 && enumMissingCount > 0
              ? `${autoMissingCount} can be enabled from your plan · ${enumMissingCount} need manual setup in Google`
              : uriMissingCount > 0 && enumMissingCount > 0
                ? `${uriMissingCount} links to add from your plan · ${enumMissingCount} need manual setup in Google`
                : autoMissingCount > 0
                  ? `${autoMissingCount} can be enabled from your plan`
                  : uriMissingCount > 0
                    ? `${uriMissingCount} profile links can be added from your plan`
                    : `${enumMissingCount} need manual setup in Google Business Profile`
        : "Enable booking, payment, and accessibility attributes where available";

    return {
      current,
      missingCurrent,
      constraint,
      status: fieldStatus(enabledCount > 0, missingCount === 0),
    };
  }

  return {
    current: attributes.length
      ? `${attributes.length} enabled: ${attributes.slice(0, 5).join(", ")}${
          attributes.length > 5 ? "…" : ""
        }`
      : "None enabled",
    status: fieldStatus(attributes.length > 0, completeness.attributeCount >= 5),
    constraint: "Enable booking, payment, and accessibility attributes where available",
  };
}

/** Build a field-by-field inventory from a collected GBP snapshot + live profile. */
export function buildGbpLocationInventory(
  input: BuildGbpLocationInventoryInput
): GbpLocationInventory {
  const {
    profile,
    identity,
    completeness,
    content,
    engagement,
    performance,
    issues,
    googleUpdateState,
    liveProfile,
    attributeCoverage,
  } = input;

  const targetKeywords = input.targetKeywords ?? [];
  const description =
    profile?.description ?? liveProfile?.description ?? "";
  const services = profile?.serviceItems ?? liveProfile?.services ?? [];
  const serviceNames = services.map((s) => s.name);
  const uncoveredKeywords =
    targetKeywords.length > 0
      ? missingServiceKeywords(targetKeywords, serviceNames)
      : [];
  const servicesGood =
    completeness.hasServices &&
    completeness.serviceCount >= 3 &&
    uncoveredKeywords.length === 0;
  // Attributes come from the dedicated locations/{id}/attributes endpoint
  // (surfaced via liveProfile), not from locations.get, so prefer the
  // non-empty source instead of nullish fallback.
  const attributes = profile?.attributes?.length
    ? profile.attributes
    : (liveProfile?.attributes ?? []);
  const secondary =
    profile?.additionalCategories.map((c) => c.displayName) ??
    identity.secondaryCategories;

  const fields: GbpLocationInventoryField[] = [
    inventoryField({
      apiPath: "title",
      label: "Business name",
      section: "identity",
      current: profile?.title || identity.name || "Not set",
      status: fieldStatus(Boolean(profile?.title || identity.name), true),
      constraint: "Use your real-world business name — no taglines or keyword stuffing",
      editable: true,
      googleUpdateState,
    }),
    inventoryField({
      apiPath: "phoneNumbers.primaryPhone",
      label: "Primary phone",
      section: "identity",
      current: profile?.phone || identity.phone || "Not set",
      status: fieldStatus(Boolean(profile?.phone || identity.phone), Boolean(profile?.phone)),
      constraint: "Local number preferred over call-center lines",
      editable: true,
      googleUpdateState,
    }),
    {
      apiPath: "phoneNumbers.additionalPhones",
      label: "Additional phones",
      section: "identity",
      current: profile?.additionalPhones?.length
        ? profile.additionalPhones.join(", ")
        : "None (optional)",
      status: "good",
      constraint: "Optional — up to two additional numbers",
      editable: false,
    },
    inventoryField({
      apiPath: "storefrontAddress",
      label: "Address",
      section: "identity",
      current: profile?.address || identity.address || "Not set",
      status: fieldStatus(Boolean(profile?.address || identity.address), Boolean(profile?.address)),
      editable: true,
      googleUpdateState,
    }),
    inventoryField({
      apiPath: "websiteUri",
      label: "Website",
      section: "identity",
      current: profile?.website || identity.website || "Not set",
      status: fieldStatus(
        Boolean(profile?.website || identity.website),
        Boolean(profile?.website || identity.website)
      ),
      editable: true,
      googleUpdateState,
    }),
    inventoryField({
      apiPath: "categories.primaryCategory",
      label: "Primary category",
      section: "identity",
      current:
        profile?.primaryCategory?.displayName ||
        identity.primaryCategory ||
        "Not set",
      status: fieldStatus(
        Boolean(profile?.primaryCategory || identity.primaryCategory),
        Boolean(profile?.primaryCategory?.displayName || identity.primaryCategory)
      ),
      constraint: "Most specific category that matches your core business",
      editable: true,
      googleUpdateState,
    }),
    {
      apiPath: "categories.additionalCategories",
      label: "Secondary categories",
      section: "identity",
      current: secondary.length ? secondary.join(", ") : "None",
      status: fieldStatus(secondary.length > 0, secondary.length >= 2),
      constraint: "Add specific secondary categories aligned to target keywords",
      editable: true,
    },
    inventoryField({
      apiPath: "profile.description",
      label: "Business description",
      section: "profile",
      current: description
        ? `${description.length} chars — ${description.slice(0, 140)}${description.length > 140 ? "…" : ""}`
        : "Empty",
      status: fieldStatus(
        completeness.hasDescription,
        completeness.descriptionLength >= 400 &&
          completeness.descriptionLength <= GBP_DESCRIPTION_MAX_LENGTH
      ),
      constraint: `Plain text, ${GBP_DESCRIPTION_MAX_LENGTH} char max, no URLs or sales copy`,
      editable: true,
      googleUpdateState,
    }),
    inventoryField({
      apiPath: "regularHours",
      label: "Regular hours",
      section: "hours",
      current: profile?.regularHours
        ? formatRegularHoursSummary(profile.regularHours)
        : completeness.hasHours
          ? "Hours set (schedule not loaded)"
          : "No regular hours",
      status: fieldStatus(completeness.hasHours, completeness.hasFullWeekHours),
      constraint: "Full-week coverage improves directions and call timing",
      editable: true,
      googleUpdateState,
    }),
    inventoryField({
      apiPath: "specialHours",
      label: "Holiday / special hours",
      section: "hours",
      current: profile?.specialHours
        ? formatSpecialHoursSummary(profile.specialHours)
        : completeness.hasHolidayHours
          ? "Configured"
          : "Not set",
      status: fieldStatus(
        hasSpecialHourPeriods(profile?.specialHours),
        hasAdequateHolidayCoverage(profile?.specialHours)
      ),
      constraint: "Add major US holidays for the full year",
      editable: true,
      googleUpdateState,
    }),
    {
      apiPath: "moreHours",
      label: "Department hours",
      section: "hours",
      current: profile?.moreHoursCount
        ? `${profile.moreHoursCount} more-hours type${profile.moreHoursCount === 1 ? "" : "s"}`
        : "None",
      status: fieldStatus(profile?.hasMoreHours ?? false, profile?.hasMoreHours ?? false),
      constraint: "Optional hours for departments (e.g. pharmacy, drive-through)",
      editable: false,
    },
    inventoryField({
      apiPath: "serviceItems",
      label: "Services",
      section: "services",
      current: services.length
        ? `${services.length} listed: ${services
            .slice(0, 4)
            .map((s) => s.name)
            .join(", ")}${services.length > 4 ? "…" : ""}${
            uncoveredKeywords.length > 0
              ? ` · missing keywords: ${uncoveredKeywords.slice(0, 3).join(", ")}${
                  uncoveredKeywords.length > 3 ? "…" : ""
                }`
              : ""
          }`
        : uncoveredKeywords.length > 0
          ? `No services on profile · missing: ${uncoveredKeywords.slice(0, 3).join(", ")}`
          : "No services on profile",
      status: fieldStatus(completeness.hasServices, servicesGood),
      constraint: "Add structured services — one per target keyword when possible",
      editable: profile?.canModifyServiceList !== false,
      googleUpdateState,
    }),
    inventoryField({
      apiPath: "attributes",
      label: "Attributes",
      section: "attributes",
      ...buildAttributesInventoryField(attributes, attributeCoverage, completeness),
      editable: true,
    }),
    {
      apiPath: "serviceArea",
      label: "Service area",
      section: "service_area",
      current: profile?.serviceAreaPlaces?.length
        ? profile.serviceAreaPlaces
            .slice(0, 5)
            .map((p) => p.placeName)
            .join(", ")
        : profile?.isServiceAreaBusiness
          ? `Service-area business (${profile.serviceAreaBusinessType ?? "type unknown"})`
          : "Storefront / no service area listed",
      status: fieldStatus(
        Boolean(profile?.serviceAreaPlaces?.length || profile?.address),
        Boolean(profile?.serviceAreaPlaces?.length || !profile?.isServiceAreaBusiness)
      ),
      constraint: "Required for service-area businesses; improves local relevance",
      editable: true,
    },
    {
      apiPath: "latlng",
      label: "Map pin",
      section: "service_area",
      current: profile?.businessLatLng
        ? `${profile.businessLatLng.lat.toFixed(5)}, ${profile.businessLatLng.lng.toFixed(5)}`
        : "Not available from API",
      status: fieldStatus(Boolean(profile?.businessLatLng), Boolean(profile?.businessLatLng)),
      editable: false,
    },
    {
      apiPath: "openInfo.status",
      label: "Open status",
      section: "status",
      current: profile?.openStatus?.replace(/_/g, " ").toLowerCase() ?? "Unknown",
      status: fieldStatus(
        Boolean(profile?.openStatus),
        profile?.openStatus === "OPEN" || !profile?.openStatus
      ),
      constraint: "Closed or temp-closed listings suppress calls and directions",
      editable: false,
    },
    {
      apiPath: "metadata.hasVoiceOfMerchant",
      label: "Voice of Merchant",
      section: "status",
      current: profile?.hasVoiceOfMerchant ? "Verified — you control the listing" : "Not verified or limited",
      status: fieldStatus(
        profile?.hasVoiceOfMerchant ?? false,
        profile?.hasVoiceOfMerchant ?? false
      ),
      constraint: "Verification holds can block description and other updates",
      editable: false,
    },
    {
      apiPath: "metadata.hasPendingEdits",
      label: "Pending Google edits",
      section: "status",
      current: profile?.hasPendingEdits
        ? "Google has pending changes on your profile"
        : "No pending edits",
      status: fieldStatus(!profile?.hasPendingEdits, completeness.noPendingEdits),
      editable: false,
    },
    {
      apiPath: "metadata.hasGoogleUpdated",
      label: "Google Updated conflicts",
      section: "status",
      current: profile?.hasGoogleUpdated
        ? `${googleUpdateState?.diffFields?.length ?? 0} conflict(s), ${
            googleUpdateState?.pendingFields?.length ?? 0
          } processing`
        : "No Google update conflicts",
      status: fieldStatus(!profile?.hasGoogleUpdated, !profile?.hasGoogleUpdated),
      editable: false,
    },
    {
      apiPath: "metadata.duplicateLocation",
      label: "Duplicate listing",
      section: "status",
      current: profile?.duplicateLocation ?? "None detected",
      status: fieldStatus(!profile?.duplicateLocation, !profile?.duplicateLocation),
      editable: false,
    },
    {
      apiPath: "content.photos",
      label: "Photos",
      section: "engagement",
      current: `${content.photoCount} photos · ${content.videoCount} videos`,
      status: fieldStatus(content.photoCount > 0, content.photoCount >= 50),
      constraint: "Cover, exterior, interior, and team photos improve engagement",
      editable: true,
    },
    {
      apiPath: "content.posts",
      label: "Google Posts",
      section: "engagement",
      current: content.postCount
        ? `${content.postCount} posts · last ${content.lastPostDate?.slice(0, 10) ?? "unknown"}`
        : "No posts",
      status: fieldStatus(
        content.postCount > 0,
        content.lastPostDate
          ? Date.now() - new Date(content.lastPostDate).getTime() <= 14 * 24 * 60 * 60 * 1000
          : false
      ),
      editable: profile?.canOperateLocalPost !== false,
    },
    {
      apiPath: "engagement.reviews",
      label: "Reviews",
      section: "engagement",
      current: `${engagement.reviewCount} reviews · ${engagement.averageRating}★ · ${Math.round(
        engagement.responseRate * 100
      )}% responded`,
      status: fieldStatus(
        engagement.reviewCount > 0,
        engagement.responseRate >= 0.9 && engagement.averageRating >= 4.0
      ),
      editable: true,
    },
    {
      apiPath: "performance.actions",
      label: "Calls · directions · clicks",
      section: "performance",
      current:
        performance.source === "api"
          ? `${performance.calls} calls · ${performance.directionRequests} directions · ${performance.websiteClicks} website clicks (${performance.periodDays}d)`
          : performance.error ?? "Performance API unavailable",
      status: fieldStatus(
        performance.source === "api",
        performance.calls + performance.directionRequests + performance.websiteClicks > 0
      ),
      editable: false,
    },
    {
      apiPath: "performance.impressions",
      label: "Search impressions",
      section: "performance",
      current:
        performance.source === "api"
          ? `${performance.impressionsMaps} Maps · ${performance.impressionsSearch} Search (${performance.periodDays}d)`
          : "Unavailable",
      status: fieldStatus(
        performance.source === "api",
        performance.impressionsMaps + performance.impressionsSearch > 0
      ),
      editable: false,
    },
    {
      apiPath: "issues.verified",
      label: "Listing health",
      section: "status",
      current: issues.isSuspended
        ? "Permanently closed"
        : issues.isVerified
          ? "Operational"
          : "Verification or suspension issue",
      status: fieldStatus(issues.isVerified && !issues.isSuspended, issues.isVerified && !issues.isSuspended),
      editable: false,
    },
  ];

  return enrichLocationInventoryScores(
    {
      collectedAt: input.collectedAt,
      source: input.source,
      fields,
      summary: summarize(fields),
    },
    {
      monthlyActions: input.monthlyActions,
      avgCustomerValue: input.avgCustomerValue,
    }
  );
}

/** Re-score the Services field once target keywords are known (after rankings collection). */
export function enrichLocationInventoryWithKeywords(
  inventory: GbpLocationInventory,
  targetKeywords: string[],
  serviceNames: string[]
): GbpLocationInventory {
  if (targetKeywords.length === 0) return inventory;

  const uncovered = missingServiceKeywords(targetKeywords, serviceNames);
  const servicesGood = serviceNames.length >= 3 && uncovered.length === 0;

  const fields = inventory.fields.map((field) => {
    if (field.apiPath !== "serviceItems") return field;

    const hasServices = serviceNames.length > 0;
    const listed = hasServices
      ? `${serviceNames.length} listed: ${serviceNames
          .slice(0, 4)
          .join(", ")}${serviceNames.length > 4 ? "…" : ""}`
      : "No services on profile";

    const current =
      uncovered.length > 0
        ? `${listed} · missing keywords: ${uncovered.slice(0, 3).join(", ")}${
            uncovered.length > 3 ? "…" : ""
          }`
        : listed;

    const status: GbpLocationFieldStatus =
      field.hasConflict
        ? "conflict"
        : field.isProcessing && hasServices
          ? "processing"
          : !hasServices
            ? "missing"
            : servicesGood
              ? "good"
              : "needs_work";

    return {
      ...field,
      current,
      status,
    };
  });

  return {
    ...inventory,
    fields,
    summary: summarize(fields),
  };
}
