import {
  customerLatLngToGridCell,
  type GridCellOffset,
} from "@/lib/geo/customer-to-cell";
import { geocodeAddress, type GeoLocation } from "@/lib/google/places";
import { resolveGridProfile, type GridProfileKey } from "@/lib/google/geo-grid";

export interface CustomerGeoInput {
  jobAddress?: string;
  jobCity?: string;
  jobZip?: string;
  jobLat?: number;
  jobLng?: number;
}

export interface ResolvedCustomerGeo {
  serviceAddress: string | null;
  serviceCity: string | null;
  serviceZip: string | null;
  serviceLat: number;
  serviceLng: number;
  gridNorth: number;
  gridEast: number;
  neighborhoodLabel: string;
  geoResolvedAt: string;
}

function buildGeocodeQuery(input: CustomerGeoInput): string | null {
  const parts = [input.jobAddress, input.jobCity, input.jobZip].filter(Boolean);
  if (parts.length === 0) return input.jobZip?.trim() || null;
  return parts.join(", ");
}

async function resolveLatLng(input: CustomerGeoInput): Promise<GeoLocation | null> {
  if (
    typeof input.jobLat === "number" &&
    Number.isFinite(input.jobLat) &&
    typeof input.jobLng === "number" &&
    Number.isFinite(input.jobLng)
  ) {
    return { lat: input.jobLat, lng: input.jobLng };
  }

  const query = buildGeocodeQuery(input);
  if (!query) return null;

  try {
    return await geocodeAddress(query);
  } catch {
    if (input.jobZip?.trim() && input.jobZip.trim() !== query) {
      try {
        return await geocodeAddress(input.jobZip.trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function resolveNeighborhoodLabel(input: {
  jobCity?: string;
  jobZip?: string;
  businessCity?: string;
}): string {
  const city = input.jobCity?.trim();
  if (city) return city;

  const businessCity = input.businessCity?.trim();
  if (businessCity) return businessCity;

  return input.jobZip?.trim() || "your neighborhood";
}

export function mapCustomerToGridCell(
  latLng: GeoLocation,
  businessCenter: GeoLocation,
  heatmapProfile: GridProfileKey = "standard"
): GridCellOffset & { zoneDirection: ReturnType<typeof customerLatLngToGridCell>["zoneDirection"] } {
  const { spacing } = resolveGridProfile(heatmapProfile);
  return customerLatLngToGridCell(latLng, businessCenter, spacing);
}

/** Resolve job-site coordinates and map to the business heatmap grid. */
export async function resolveCustomerGeo(input: {
  geo: CustomerGeoInput;
  businessCenter: GeoLocation;
  businessCity?: string;
  heatmapProfile?: GridProfileKey;
}): Promise<ResolvedCustomerGeo | null> {
  const latLng = await resolveLatLng(input.geo);
  if (!latLng) return null;

  const cell = mapCustomerToGridCell(
    latLng,
    input.businessCenter,
    input.heatmapProfile ?? "standard"
  );

  return {
    serviceAddress: input.geo.jobAddress?.trim() || null,
    serviceCity: input.geo.jobCity?.trim() || null,
    serviceZip: input.geo.jobZip?.trim() || null,
    serviceLat: latLng.lat,
    serviceLng: latLng.lng,
    gridNorth: cell.gridNorth,
    gridEast: cell.gridEast,
    neighborhoodLabel: resolveNeighborhoodLabel({
      jobCity: input.geo.jobCity,
      jobZip: input.geo.jobZip,
      businessCity: input.businessCity,
    }),
    geoResolvedAt: new Date().toISOString(),
  };
}
