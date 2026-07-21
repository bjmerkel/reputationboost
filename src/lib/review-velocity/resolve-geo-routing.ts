import type { ClientConfig, FullAuditPayload } from "@/audit/types";
import type { CustomerRecord } from "@/lib/customers/types";
import {
  isCellSendCapReachedAdmin,
  loadKeywordGridsForAuditKeywords,
} from "@/lib/review-velocity/storage";
import { routeGeoReviewRequest, type GeoRoutingDecision } from "@/lib/review-velocity/geo-router";
import { loadCellLiftAggregatesAdmin } from "@/lib/review-velocity/lift-storage";
import type { GeoGridPoint } from "@/audit/types";

export interface CustomerGeoRoutingResult {
  geoRouting: GeoRoutingDecision | null;
  deferred: boolean;
  deferReason?: string;
}

export async function loadKeywordGridsForAudit(
  businessId: string,
  audit: FullAuditPayload
): Promise<Map<string, GeoGridPoint[]>> {
  const keywords =
    audit.strategy.gbpPlan?.keywordRankings?.map((row) => row.keyword) ?? [];
  if (keywords.length === 0) return new Map();
  return loadKeywordGridsForAuditKeywords(businessId, keywords);
}

export async function routeCustomerGeoReview(input: {
  businessId: string;
  business: ClientConfig;
  customer: CustomerRecord;
  audit: FullAuditPayload;
  keywordGrids?: Map<string, GeoGridPoint[]>;
  checkCellCap?: boolean;
}): Promise<CustomerGeoRoutingResult> {
  if (input.customer.grid_north == null || input.customer.grid_east == null) {
    return { geoRouting: null, deferred: false };
  }

  const keywordGrids =
    input.keywordGrids ?? (await loadKeywordGridsForAudit(input.businessId, input.audit));
  if (keywordGrids.size === 0) {
    return { geoRouting: null, deferred: false };
  }

  const liftAggregates = await loadCellLiftAggregatesAdmin(input.businessId);

  const geoRouting = routeGeoReviewRequest({
    audit: input.audit,
    customer: input.customer,
    keywordGrids,
    neighborhoodLabel: input.customer.service_city ?? undefined,
    location: {
      city: input.business.location.city,
      state: input.business.location.state,
    },
    liftAggregates,
  });

  if (!geoRouting) {
    return { geoRouting: null, deferred: false };
  }

  if (input.checkCellCap !== false) {
    const capReached = await isCellSendCapReachedAdmin(
      input.businessId,
      geoRouting.targetCell.gridNorth,
      geoRouting.targetCell.gridEast
    );
    if (capReached) {
      return {
        geoRouting,
        deferred: true,
        deferReason: "cell_weekly_cap_reached",
      };
    }
  }

  return { geoRouting, deferred: false };
}
