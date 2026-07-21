import type { FullAuditPayload, GeoGridPoint } from "@/audit/types";
import type { ZoneDirection } from "@/audit/geo/types";
import {
  customerMatchesKeyword,
  resolveFocusKeywordForCustomer,
} from "@/lib/review-requests/campaign-plan";
import { naturalServicePhrase, type ServicePhraseLocation } from "@/lib/review-requests/service-phrase";
import type { CustomerRecord } from "@/lib/customers/types";
import {
  buildKeywordWeaknessIndex,
  isCellStrongEnoughToSkip,
  weaknessScoresForCell,
  applyLiftAggregatesToScores,
  type CellWeaknessScore,
} from "./cell-weakness";
import type { CellLiftAggregate } from "@/lib/review-velocity/lift-storage";

export interface GeoRoutingDecision {
  focusKeyword: string;
  targetCell: { gridNorth: number; gridEast: number };
  targetZone: ZoneDirection;
  neighborhoodLabel: string;
  weaknessScore: number;
  promptSeed: string;
  geoTargeted: boolean;
}

export interface GeoRoutingInput {
  audit: FullAuditPayload;
  customer: Pick<
    CustomerRecord,
    "service_notes" | "service_city" | "grid_north" | "grid_east"
  >;
  keywordGrids: Map<string, GeoGridPoint[]>;
  neighborhoodLabel?: string;
  location?: ServicePhraseLocation;
  liftAggregates?: Map<string, CellLiftAggregate>;
}

function reviewGapByKeyword(audit: FullAuditPayload): Map<string, number> {
  const gaps = new Map<string, number>();
  for (const row of audit.strategy.gbpPlan?.keywordRankings ?? []) {
    gaps.set(row.keyword, row.reviewGap);
  }
  return gaps;
}

function buildPromptSeed(
  keyword: string,
  neighborhood: string,
  location?: ServicePhraseLocation
): string {
  const service = naturalServicePhrase(keyword, location);
  if (!neighborhood || neighborhood === "your neighborhood") {
    return service;
  }
  return `${service} in ${neighborhood}`;
}

function pickKeywordForCell(
  audit: FullAuditPayload,
  customer: GeoRoutingInput["customer"],
  cellScores: CellWeaknessScore[]
): CellWeaknessScore | null {
  if (cellScores.length === 0) return null;

  const matched = cellScores.filter((score) =>
    customerMatchesKeyword(customer, score.keyword)
  );
  if (matched.length > 0) return matched[0];

  const fallbackKeyword = resolveFocusKeywordForCustomer(audit, customer);
  if (fallbackKeyword) {
    const fallback = cellScores.find(
      (score) => score.keyword.toLowerCase() === fallbackKeyword.toLowerCase()
    );
    if (fallback) return fallback;
  }

  return cellScores[0];
}

/** Route a review request based on the customer's grid cell and keyword weakness. */
export function routeGeoReviewRequest(input: GeoRoutingInput): GeoRoutingDecision | null {
  const gridNorth = input.customer.grid_north;
  const gridEast = input.customer.grid_east;
  if (gridNorth == null || gridEast == null) return null;
  if (input.keywordGrids.size === 0) return null;

  const weaknessIndex = applyLiftAggregatesToScores(
    buildKeywordWeaknessIndex(
      input.keywordGrids,
      reviewGapByKeyword(input.audit)
    ),
    input.liftAggregates ?? new Map()
  );
  const cellScores = weaknessScoresForCell(weaknessIndex, Number(gridNorth), Number(gridEast));
  if (cellScores.length === 0 || isCellStrongEnoughToSkip(cellScores)) {
    return null;
  }

  const picked = pickKeywordForCell(input.audit, input.customer, cellScores);
  if (!picked) return null;

  const neighborhoodLabel =
    input.neighborhoodLabel?.trim() ||
    input.customer.service_city?.trim() ||
    input.location?.city?.trim() ||
    "your neighborhood";

  return {
    focusKeyword: picked.keyword,
    targetCell: { gridNorth: picked.gridNorth, gridEast: picked.gridEast },
    targetZone: picked.zoneDirection,
    neighborhoodLabel,
    weaknessScore: picked.weaknessScore,
    promptSeed: buildPromptSeed(picked.keyword, neighborhoodLabel, input.location),
    geoTargeted: true,
  };
}

export function selectCustomersForGeoCampaign<
  T extends Pick<CustomerRecord, "service_notes" | "grid_north" | "grid_east">,
>(input: {
  customers: T[];
  audit: FullAuditPayload;
  keywordGrids: Map<string, GeoGridPoint[]>;
  batchSize: number;
  focusKeyword?: string | null;
  liftAggregates?: Map<string, CellLiftAggregate>;
}): { customers: T[]; geoFilterApplied: boolean } {
  const weaknessIndex = applyLiftAggregatesToScores(
    buildKeywordWeaknessIndex(
      input.keywordGrids,
      reviewGapByKeyword(input.audit)
    ),
    input.liftAggregates ?? new Map()
  );

  const scored = input.customers
    .map((customer) => {
      if (customer.grid_north == null || customer.grid_east == null) {
        return { customer, score: -1 };
      }

      const cellScores = weaknessScoresForCell(
        weaknessIndex,
        Number(customer.grid_north),
        Number(customer.grid_east)
      );
      const focus = input.focusKeyword?.trim();
      const picked = focus
        ? cellScores.find((row) => row.keyword.toLowerCase() === focus.toLowerCase()) ??
          cellScores[0]
        : cellScores[0];

      return { customer, score: picked?.weaknessScore ?? -1 };
    })
    .sort((a, b) => b.score - a.score);

  const withGeo = scored.filter((row) => row.score >= 0);
  if (withGeo.length === 0) {
    return { customers: input.customers.slice(0, input.batchSize), geoFilterApplied: false };
  }

  return {
    customers: withGeo.slice(0, input.batchSize).map((row) => row.customer),
    geoFilterApplied: true,
  };
}
