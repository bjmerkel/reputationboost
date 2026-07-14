import type {
  GbpConnection,
  GbpPersistedServiceArea,
} from "@/audit/types";
import {
  enrichGbpLocationProfile,
  getGbpLocationProfile,
  type GbpLocationProfile,
} from "./gbp-location";

export interface GbpIdentitySnapshot {
  name: string;
  address: string;
  phone: string;
  website: string;
  placeId: string;
  mapsUrl: string;
  primaryCategory: string;
  secondaryCategories: string[];
  openStatus: string | null;
  businessLatLng: { lat: number; lng: number } | null;
  serviceArea: GbpPersistedServiceArea;
}

export function gbpIdentitySnapshotFromProfile(
  profile: GbpLocationProfile
): GbpIdentitySnapshot {
  return {
    name: profile.title,
    address: profile.address,
    phone: profile.phone,
    website: profile.website,
    placeId: profile.placeId,
    mapsUrl: profile.mapsUri,
    primaryCategory: profile.primaryCategory?.displayName ?? "",
    secondaryCategories: profile.additionalCategories
      .map((category) => category.displayName)
      .filter(Boolean),
    openStatus: profile.openStatus,
    businessLatLng: profile.businessLatLng,
    serviceArea: {
      version: 1,
      businessType: profile.serviceAreaBusinessType,
      places: profile.serviceAreaPlaces,
      businessLatLng: profile.businessLatLng,
    },
  };
}

/** Fetch the authoritative owned-location identity used outside live audits. */
export async function fetchGbpIdentitySnapshot(
  connection: GbpConnection
): Promise<GbpIdentitySnapshot> {
  const profile = await enrichGbpLocationProfile(
    connection,
    await getGbpLocationProfile(connection)
  );
  return gbpIdentitySnapshotFromProfile(profile);
}
