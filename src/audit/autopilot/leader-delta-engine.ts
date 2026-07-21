import type {
  CompetitorProfile,
  GeoGridPoint,
  GbpSnapshot,
  Phase1AuditPayload,
} from "@/audit/types";
import { resolveCalibrationConfidence } from "@/audit/phase2/attribution-calibration";
import { uncalibratedRankPriorForStep } from "@/audit/phase2/rank-priors";
import { missingServiceKeywords } from "@/lib/google/gbp-service-descriptions";
import { classifyLosingCells } from "./cell-loss-classifier";
import {
  buildCompetitorProfileIndex,
  resolveCompetitorProfile,
  type CompetitorProfileIndex,
} from "./competitor-profile-index";
import type { ClientProfileSnapshot, LeaderDelta, LeaderDeltaAction } from "./types";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueLower(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

export function buildClientProfileSnapshot(gbp: GbpSnapshot): ClientProfileSnapshot {
  const live = gbp.liveProfile;
  const services = (live?.services ?? []).map((service) => service.name);
  return {
    primaryCategory: live?.primaryCategory ?? gbp.identity.primaryCategory ?? "",
    secondaryCategories: uniqueLower(
      live?.secondaryCategories ?? gbp.identity.secondaryCategories ?? []
    ),
    reviewCount: gbp.engagement.reviewCount,
    reviewVelocity30d: gbp.engagement.reviewsLast30Days,
    rating: gbp.engagement.averageRating || null,
    photoCount: gbp.content.photoCount,
    photoRecencyDays: daysSince(gbp.content.lastPhotoUpload),
    postCadenceDays: daysSince(gbp.content.lastPostDate),
    postsLast30Days: gbp.localPosts?.postsLast30Days ?? gbp.content.postCount,
    services: uniqueLower(services),
    attributeCount:
      live?.attributes?.length ??
      gbp.attributeCoverage?.enabledCount ??
      0,
    descriptionLength: (live?.description ?? "").length,
  };
}

function leaderFromCell(cell: GeoGridPoint): {
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number;
} | null {
  const leader = cell.localPack?.[0];
  if (!leader) return null;
  return {
    placeId: leader.placeId,
    name: leader.name,
    rating: leader.rating,
    reviewCount: leader.reviewCount,
  };
}

function leaderProfileState(
  profile: CompetitorProfile | null,
  cellLeader: NonNullable<ReturnType<typeof leaderFromCell>>
): {
  primaryCategory: string;
  secondaryCategories: string[];
  reviewCount: number;
  reviewVelocity30d: number;
  rating: number | null;
  photoCount: number;
  photoRecencyDays: number | null;
  postCadenceDays: number | null;
  postsLast30Days: number;
  services: string[];
  attributeCount: number;
  descriptionLength: number;
} {
  return {
    primaryCategory: profile?.primaryCategory ?? "",
    secondaryCategories: [],
    reviewCount: Math.max(profile?.reviewCount ?? 0, cellLeader.reviewCount),
    reviewVelocity30d: profile?.newReviewsThisMonth ?? 0,
    rating: profile?.averageRating ?? cellLeader.rating,
    photoCount: profile?.photoCount ?? 0,
    photoRecencyDays: null,
    postCadenceDays: daysSince(profile?.lastPostDate ?? null),
    postsLast30Days: profile?.postsLast30Days ?? 0,
    services: [],
    attributeCount: profile?.attributeCount ?? 0,
    descriptionLength: profile?.descriptionLength ?? 0,
  };
}

function stepEffort(stepNumber: number): number {
  switch (stepNumber) {
    case 10:
      return 8;
    case 5:
    case 4:
      return 6;
    case 8:
      return 4;
    case 6:
      return 5;
    default:
      return 5;
  }
}

function buildRankedActions(params: {
  keyword: string;
  leaderName: string;
  client: ClientProfileSnapshot;
  leader: ReturnType<typeof leaderProfileState>;
  missingServices: string[];
}): LeaderDeltaAction[] {
  const actions: LeaderDeltaAction[] = [];
  const { keyword, leaderName, client, leader, missingServices } = params;

  if (
    leader.primaryCategory &&
    normalizeCategory(leader.primaryCategory) !== normalizeCategory(client.primaryCategory)
  ) {
    actions.push({
      actionType: "gbp_primary_category",
      planStepNumber: 5,
      hypothesis: `Switch primary category to “${leader.primaryCategory}” — ${leaderName} ranks #1 here with that category; yours is “${client.primaryCategory || "not set"}”.`,
      marketPriorRankDelta: uncalibratedRankPriorForStep(5),
      confidence: "default",
      effort: stepEffort(5),
    });
  }

  for (const secondary of leader.secondaryCategories) {
    const has = client.secondaryCategories.some(
      (value) => normalizeCategory(value) === normalizeCategory(secondary)
    );
    if (!has) {
      actions.push({
        actionType: "gbp_secondary_categories",
        planStepNumber: 5,
        hypothesis: `Add secondary category “${secondary}” — ${leaderName} lists it and you do not.`,
        marketPriorRankDelta: uncalibratedRankPriorForStep(2),
        confidence: "default",
        effort: stepEffort(5),
      });
      break;
    }
  }

  if (leader.reviewCount > client.reviewCount) {
    const gap = leader.reviewCount - client.reviewCount;
    const velocityNote =
      leader.reviewVelocity30d > client.reviewVelocity30d
        ? ` (+${leader.reviewVelocity30d}/mo vs your +${client.reviewVelocity30d}/mo)`
        : "";
    actions.push({
      actionType: "review_request",
      planStepNumber: 10,
      hypothesis: `Close a ${gap}-review gap${velocityNote} — ${leaderName} has ${leader.reviewCount} vs your ${client.reviewCount}.`,
      marketPriorRankDelta: uncalibratedRankPriorForStep(10),
      confidence: "default",
      effort: stepEffort(10),
    });
  }

  if (leader.photoCount > client.photoCount && leader.photoCount > 0) {
    actions.push({
      actionType: "gbp_photo",
      planStepNumber: 6,
      hypothesis: `Add photos — ${leaderName} shows ${leader.photoCount} vs your ${client.photoCount}.`,
      marketPriorRankDelta: 0,
      confidence: "default",
      effort: stepEffort(6),
    });
  }

  const leaderPostsRecently =
    leader.postCadenceDays != null && leader.postCadenceDays <= 14;
  const clientPostsStale =
    client.postCadenceDays == null || client.postCadenceDays > 21;
  if (leaderPostsRecently && clientPostsStale) {
    const leaderCadence =
      leader.postCadenceDays != null
        ? `last posted ${leader.postCadenceDays}d ago`
        : `${leader.postsLast30Days} posts in 30d`;
    const clientCadence =
      client.postCadenceDays != null
        ? `your last post was ${client.postCadenceDays}d ago`
        : "you have no recent posts";
    actions.push({
      actionType: "google_post",
      planStepNumber: 8,
      hypothesis: `Match post cadence — ${leaderName} ${leaderCadence}; ${clientCadence}.`,
      marketPriorRankDelta: 0,
      confidence: "default",
      effort: stepEffort(8),
    });
  }

  if (missingServices.length > 0) {
    const listed = missingServices.slice(0, 2).map((service) => `“${service}”`).join(" and ");
    actions.push({
      actionType: "gbp_services",
      planStepNumber: 4,
      hypothesis: `Add ${listed} to GBP services — not listed on your profile for “${keyword}”.`,
      marketPriorRankDelta: uncalibratedRankPriorForStep(4),
      confidence: "default",
      effort: stepEffort(4),
    });
  }

  if (
    leader.descriptionLength > client.descriptionLength + 120 &&
    leader.descriptionLength > 0
  ) {
    actions.push({
      actionType: "gbp_description",
      planStepNumber: 3,
      hypothesis: `Expand description — ${leaderName}'s profile copy is ~${leader.descriptionLength} chars vs your ${client.descriptionLength}.`,
      marketPriorRankDelta: uncalibratedRankPriorForStep(3),
      confidence: "default",
      effort: stepEffort(3),
    });
  }

  if (leader.attributeCount > client.attributeCount + 2 && leader.attributeCount > 0) {
    actions.push({
      actionType: "gbp_attributes",
      planStepNumber: 13,
      hypothesis: `Enable more GBP attributes — ${leaderName} shows ${leader.attributeCount} vs your ${client.attributeCount}.`,
      marketPriorRankDelta: 0,
      confidence: "default",
      effort: stepEffort(13),
    });
  }

  return actions
    .sort((a, b) => {
      const scoreA = a.marketPriorRankDelta / a.effort;
      const scoreB = b.marketPriorRankDelta / b.effort;
      return scoreB - scoreA;
    })
    .map((action) => ({
      ...action,
      confidence: resolveCalibrationConfidence(0),
    }));
}

export function computeLeaderDelta(params: {
  keyword: string;
  cell: GeoGridPoint;
  client: ClientProfileSnapshot;
  leaderProfile?: CompetitorProfile | null;
  missingServices?: string[];
}): LeaderDelta | null {
  const cellLeader = leaderFromCell(params.cell);
  if (!cellLeader) return null;

  const leader = leaderProfileState(params.leaderProfile ?? null, cellLeader);
  const client = params.client;
  const missingServices =
    params.missingServices ??
    missingServiceKeywords(
      [params.keyword],
      client.services.map((service) => service.toLowerCase())
    );

  const primaryMatch =
    !leader.primaryCategory ||
    normalizeCategory(leader.primaryCategory) === normalizeCategory(client.primaryCategory);

  const missingSecondary = leader.secondaryCategories.filter(
    (value) =>
      !client.secondaryCategories.some(
        (clientValue) => normalizeCategory(clientValue) === normalizeCategory(value)
      )
  );

  const delta: LeaderDelta = {
    keyword: params.keyword,
    gridNorth: params.cell.offsetNorthMiles,
    gridEast: params.cell.offsetEastMiles,
    leaderPlaceId: cellLeader.placeId,
    leaderName: cellLeader.name,
    clientRank: params.cell.rank,
    dimensions: {
      primaryCategory: {
        client: client.primaryCategory || "Not set",
        leader: leader.primaryCategory || "Unknown",
        gap: null,
        leaderAhead: !primaryMatch,
        match: primaryMatch,
      },
      secondaryCategories: {
        client: client.secondaryCategories,
        leader: leader.secondaryCategories,
        missing: missingSecondary,
        extra: [],
        leaderAhead: missingSecondary.length > 0,
      },
      reviewCount: {
        client: client.reviewCount,
        leader: leader.reviewCount,
        gap: Math.max(0, leader.reviewCount - client.reviewCount),
        leaderAhead: leader.reviewCount > client.reviewCount,
      },
      reviewVelocity30d: {
        client: client.reviewVelocity30d,
        leader: leader.reviewVelocity30d,
        gap: Math.max(0, leader.reviewVelocity30d - client.reviewVelocity30d),
        leaderAhead: leader.reviewVelocity30d > client.reviewVelocity30d,
      },
      rating: {
        client: client.rating,
        leader: leader.rating,
        gap:
          leader.rating != null && client.rating != null
            ? Math.max(0, leader.rating - client.rating)
            : null,
        leaderAhead:
          leader.rating != null &&
          client.rating != null &&
          leader.rating > client.rating,
      },
      photoCount: {
        client: client.photoCount,
        leader: leader.photoCount,
        gap: Math.max(0, leader.photoCount - client.photoCount),
        leaderAhead: leader.photoCount > client.photoCount,
      },
      photoRecencyDays: {
        client: client.photoRecencyDays,
        leader: leader.photoRecencyDays,
        gap: null,
        leaderAhead:
          client.photoRecencyDays != null &&
          leader.photoRecencyDays != null &&
          leader.photoRecencyDays < client.photoRecencyDays,
      },
      postCadenceDays: {
        client: client.postCadenceDays,
        leader: leader.postCadenceDays,
        gap: null,
        leaderAhead:
          leader.postCadenceDays != null &&
          (client.postCadenceDays == null ||
            leader.postCadenceDays < client.postCadenceDays),
      },
      servicesListed: {
        client: client.services,
        leader: leader.services,
        missing: missingServices,
        leaderAhead: missingServices.length > 0,
      },
      attributeCount: {
        client: client.attributeCount,
        leader: leader.attributeCount,
        gap: Math.max(0, leader.attributeCount - client.attributeCount),
        leaderAhead: leader.attributeCount > client.attributeCount,
      },
      descriptionLength: {
        client: client.descriptionLength,
        leader: leader.descriptionLength,
        gap: Math.max(0, leader.descriptionLength - client.descriptionLength),
        leaderAhead: leader.descriptionLength > client.descriptionLength,
      },
    },
    rankedActions: buildRankedActions({
      keyword: params.keyword,
      leaderName: cellLeader.name,
      client,
      leader,
      missingServices,
    }),
  };

  return delta;
}

export function formatCellDirection(gridNorth: number, gridEast: number): string {
  if (gridNorth === 0 && gridEast === 0) return "at your location";
  const ns = `${Math.abs(gridNorth).toFixed(1)} mi ${gridNorth >= 0 ? "N" : "S"}`;
  const ew = `${Math.abs(gridEast).toFixed(1)} mi ${gridEast >= 0 ? "E" : "W"}`;
  return `${ns} · ${ew}`;
}

export function formatLeaderDeltaSummary(delta: LeaderDelta): string {
  const location = formatCellDirection(delta.gridNorth, delta.gridEast);
  const topAction = delta.rankedActions[0];
  if (topAction) return `${location}: ${topAction.hypothesis}`;
  return `${delta.leaderName} leads the sample ${location} where you rank ${
    delta.clientRank == null ? "outside the top 20" : `#${delta.clientRank}`
  }.`;
}

export function findTopLeaderDeltaForKeyword(
  audit: Phase1AuditPayload,
  keyword: string,
  options: {
    competitorIndex?: CompetitorProfileIndex;
    impressions?: number;
  } = {}
): LeaderDelta | null {
  const snapshot = audit.rankings.keywords.find(
    (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
  );
  if (!snapshot?.geoGrid?.length) return null;

  const index =
    options.competitorIndex ?? buildCompetitorProfileIndex(audit.competitors);
  const client = buildClientProfileSnapshot(audit.gbp);
  const impressions =
    options.impressions ??
    audit.gbp.performance.searchKeywords?.find(
      (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
    )?.impressions ??
    0;
  const impressionsWeight = impressions > 0 ? Math.log10(impressions + 10) : 1;
  const losing = classifyLosingCells(snapshot.geoGrid, impressionsWeight);
  if (losing.length === 0) return null;

  for (const cellSummary of losing) {
    const cell = snapshot.geoGrid.find(
      (point) =>
        point.offsetNorthMiles === cellSummary.gridNorth &&
        point.offsetEastMiles === cellSummary.gridEast
    );
    if (!cell) continue;

    const leaderProfile = resolveCompetitorProfile(
      index,
      keyword,
      cellSummary.leaderPlaceId
    );
    const delta = computeLeaderDelta({
      keyword,
      cell,
      client,
      leaderProfile,
    });
    if (delta) return delta;
  }

  return null;
}

export function summarizeLeaderGaps(delta: LeaderDelta, limit = 3): string[] {
  const lines: string[] = [];
  const { dimensions: d, leaderName } = delta;

  if (d.reviewCount.leaderAhead && d.reviewCount.gap) {
    const velocity =
      d.reviewVelocity30d.leaderAhead && d.reviewVelocity30d.gap
        ? ` (+${d.reviewVelocity30d.leader}/${d.reviewVelocity30d.client} reviews/mo)`
        : "";
    lines.push(
      `${leaderName}: ${d.reviewCount.leader} reviews vs your ${d.reviewCount.client}${velocity}`
    );
  }

  if (d.primaryCategory.leaderAhead) {
    lines.push(
      `Category: ${leaderName} uses “${d.primaryCategory.leader}”; yours is “${d.primaryCategory.client}”`
    );
  }

  if (d.photoCount.leaderAhead && d.photoCount.gap) {
    lines.push(
      `Photos: ${d.photoCount.leader} vs your ${d.photoCount.client}`
    );
  }

  if (d.postCadenceDays.leaderAhead) {
    const leaderDays =
      d.postCadenceDays.leader != null
        ? `${d.postCadenceDays.leader}d since last post`
        : "active posting";
    const clientDays =
      d.postCadenceDays.client != null
        ? `${d.postCadenceDays.client}d since yours`
        : "no recent posts";
    lines.push(`Posts: ${leaderName} ${leaderDays}; ${clientDays}`);
  }

  if (d.servicesListed.missing.length > 0) {
    lines.push(
      `Services missing: ${d.servicesListed.missing
        .slice(0, 2)
        .map((service) => `“${service}”`)
        .join(", ")}`
    );
  }

  if (d.descriptionLength.leaderAhead && d.descriptionLength.gap) {
    lines.push(
      `Description: ~${d.descriptionLength.leader} chars vs your ${d.descriptionLength.client}`
    );
  }

  return lines.slice(0, limit);
}
