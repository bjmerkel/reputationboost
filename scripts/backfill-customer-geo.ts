#!/usr/bin/env npx tsx
/**
 * Backfill customer job-site geo fields from stored webhook payloads or ZIP codes.
 *
 * Usage:
 *   npx tsx scripts/backfill-customer-geo.ts
 *   npx tsx scripts/backfill-customer-geo.ts --business-id=<uuid>
 *   npx tsx scripts/backfill-customer-geo.ts --dry-run
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { upsertCustomerAdmin } from "../src/lib/customers/storage-admin";
import { resolveCustomerGeo } from "../src/lib/geo/resolve-customer-location";
import type { GridProfileKey } from "../src/lib/google/geo-grid";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readGeoFromPayload(payload: Record<string, unknown>) {
  const readString = (keys: string[]) => {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
  };

  const readNumber = (keys: string[]) => {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  };

  return {
    jobAddress: readString(["jobAddress", "job_address", "propertyAddress", "address"]),
    jobCity: readString(["jobCity", "job_city", "city", "serviceCity"]),
    jobZip: readString(["jobZip", "job_zip", "zip", "postalCode"]),
    jobLat: readNumber(["jobLat", "job_lat", "latitude", "lat"]),
    jobLng: readNumber(["jobLng", "job_lng", "longitude", "lng"]),
  };
}

async function main() {
  const businessIdFilter = readArg("business-id");
  const dryRun = process.argv.includes("--dry-run");
  const supabase = createAdminClient();

  let customerQuery = supabase
    .from("customers")
    .select("id, business_id, user_id, phone, service_zip, grid_north, grid_east")
    .is("grid_north", null);

  if (businessIdFilter) {
    customerQuery = customerQuery.eq("business_id", businessIdFilter);
  }

  const { data: customers, error } = await customerQuery.limit(500);
  if (error) throw new Error(error.message);

  let updated = 0;
  let skipped = 0;

  for (const customer of customers ?? []) {
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("location, heatmap_profile")
      .eq("id", customer.business_id)
      .maybeSingle();

    if (businessError) throw new Error(businessError.message);
    const location = business?.location as {
      lat?: number;
      lng?: number;
      city?: string;
    } | null;
    if (location?.lat == null || location?.lng == null) {
      skipped++;
      continue;
    }

    const { data: events } = await supabase
      .from("customer_events")
      .select("payload")
      .eq("customer_id", customer.id)
      .order("occurred_at", { ascending: false })
      .limit(5);

    let geoInput = readGeoFromPayload({});
    for (const event of events ?? []) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const candidate = readGeoFromPayload(payload);
      if (
        candidate.jobAddress ||
        candidate.jobCity ||
        candidate.jobZip ||
        candidate.jobLat != null ||
        candidate.jobLng != null
      ) {
        geoInput = candidate;
        break;
      }
    }

    if (!geoInput.jobZip && customer.service_zip) {
      geoInput.jobZip = customer.service_zip;
    }

    if (
      !geoInput.jobAddress &&
      !geoInput.jobCity &&
      !geoInput.jobZip &&
      geoInput.jobLat == null &&
      geoInput.jobLng == null
    ) {
      skipped++;
      continue;
    }

    const resolved = await resolveCustomerGeo({
      geo: geoInput,
      businessCenter: { lat: Number(location.lat), lng: Number(location.lng) },
      businessCity: location?.city ?? undefined,
      heatmapProfile: (business?.heatmap_profile as GridProfileKey | null) ?? "standard",
    });

    if (!resolved) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] ${customer.phone}: ${resolved.serviceCity ?? resolved.serviceZip ?? "geocoded"} -> cell ${resolved.gridNorth},${resolved.gridEast}`
      );
      updated++;
      continue;
    }

    await upsertCustomerAdmin(customer.user_id as string, customer.business_id as string, {
      phone: customer.phone as string,
      serviceAddress: resolved.serviceAddress ?? undefined,
      serviceCity: resolved.serviceCity ?? undefined,
      serviceZip: resolved.serviceZip ?? undefined,
      serviceLat: resolved.serviceLat,
      serviceLng: resolved.serviceLng,
      gridNorth: resolved.gridNorth,
      gridEast: resolved.gridEast,
      geoResolvedAt: resolved.geoResolvedAt,
    });
    updated++;
  }

  console.log(
    `Customer geo backfill complete: ${updated} updated, ${skipped} skipped${dryRun ? " (dry run)" : ""}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
