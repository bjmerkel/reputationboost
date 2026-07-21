import type { ClientConfig, FullAuditPayload } from "@/audit/types";
import { upsertCustomerAdmin } from "@/lib/customers/storage-admin";
import type { CustomerRecord } from "@/lib/customers/types";
import {
  resolveCustomerGeo,
  type CustomerGeoInput,
} from "@/lib/geo/resolve-customer-location";
import { resolveFocusKeywordForCustomer } from "@/lib/review-requests/campaign-plan";
import {
  isCellSendCapReachedAdmin,
  loadKeywordGridsForAuditKeywords,
} from "@/lib/review-velocity/storage";
import { routeGeoReviewRequest, type GeoRoutingDecision } from "@/lib/review-velocity/geo-router";

export interface PreparedGeoReviewContext {
  customer: CustomerRecord;
  focusKeyword: string | null;
  geoRouting: GeoRoutingDecision | null;
  geoDeferred: boolean;
  geoDeferReason?: string;
}

export async function prepareGeoReviewContext(input: {
  userId: string;
  businessId: string;
  business: ClientConfig;
  customer: CustomerRecord;
  audit: FullAuditPayload | null;
  webhookGeo?: CustomerGeoInput;
}): Promise<PreparedGeoReviewContext> {
  let customer = input.customer;
  let geoRouting: GeoRoutingDecision | null = null;
  let geoDeferred = false;
  let geoDeferReason: string | undefined;

  const hasGeoInput =
    input.webhookGeo &&
    (input.webhookGeo.jobLat != null ||
      input.webhookGeo.jobLng != null ||
      input.webhookGeo.jobAddress ||
      input.webhookGeo.jobCity ||
      input.webhookGeo.jobZip);

  if (hasGeoInput && input.business.location.lat && input.business.location.lng) {
    const resolved = await resolveCustomerGeo({
      geo: input.webhookGeo!,
      businessCenter: {
        lat: input.business.location.lat,
        lng: input.business.location.lng,
      },
      businessCity: input.business.location.city,
      heatmapProfile: input.business.heatmapProfile,
    });

    if (resolved) {
      customer = await upsertCustomerAdmin(input.userId, input.businessId, {
        phone: customer.phone,
        serviceAddress: resolved.serviceAddress ?? undefined,
        serviceCity: resolved.serviceCity ?? undefined,
        serviceZip: resolved.serviceZip ?? undefined,
        serviceLat: resolved.serviceLat,
        serviceLng: resolved.serviceLng,
        gridNorth: resolved.gridNorth,
        gridEast: resolved.gridEast,
        geoResolvedAt: resolved.geoResolvedAt,
      });
    }
  }

  const focusKeywordFallback = input.audit
    ? resolveFocusKeywordForCustomer(input.audit, customer)
    : null;

  if (!input.audit || customer.grid_north == null || customer.grid_east == null) {
    return {
      customer,
      focusKeyword: focusKeywordFallback,
      geoRouting: null,
      geoDeferred: false,
    };
  }

  const keywords =
    input.audit.strategy.gbpPlan?.keywordRankings?.map((row) => row.keyword) ?? [];
  if (keywords.length === 0) {
    return {
      customer,
      focusKeyword: focusKeywordFallback,
      geoRouting: null,
      geoDeferred: false,
    };
  }

  const keywordGrids = await loadKeywordGridsForAuditKeywords(input.businessId, keywords);
  if (keywordGrids.size === 0) {
    return {
      customer,
      focusKeyword: focusKeywordFallback,
      geoRouting: null,
      geoDeferred: false,
    };
  }

  geoRouting = routeGeoReviewRequest({
    audit: input.audit,
    customer,
    keywordGrids,
    neighborhoodLabel: customer.service_city ?? undefined,
    location: {
      city: input.business.location.city,
      state: input.business.location.state,
    },
  });

  if (!geoRouting) {
    return {
      customer,
      focusKeyword: focusKeywordFallback,
      geoRouting: null,
      geoDeferred: false,
    };
  }

  const capReached = await isCellSendCapReachedAdmin(
    input.businessId,
    geoRouting.targetCell.gridNorth,
    geoRouting.targetCell.gridEast
  );

  if (capReached) {
    geoDeferred = true;
    geoDeferReason = "cell_weekly_cap_reached";
    return {
      customer,
      focusKeyword: geoRouting.focusKeyword,
      geoRouting,
      geoDeferred,
      geoDeferReason,
    };
  }

  return {
    customer,
    focusKeyword: geoRouting.focusKeyword,
    geoRouting,
    geoDeferred: false,
  };
}
