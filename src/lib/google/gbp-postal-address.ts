import type { GbpPostalAddress } from "./gbp-google-updated";

const COUNTRY_LIKE = /^(?:USA|US|United States|Canada|UK|United Kingdom)$/i;

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

function normalizeStateToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return US_STATE_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

function parseStateZipSegment(segment: string): { state: string; postalCode: string } | null {
  const match = segment.match(/^(.+?)\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return null;
  return {
    state: normalizeStateToken(match[1]!),
    postalCode: match[2]!,
  };
}

/**
 * Parse a US mailing address string into Google's PostalAddress shape.
 * GBP rejects a full formatted address in a single addressLines entry.
 */
export function parseUsPostalAddress(address: string): GbpPostalAddress {
  const trimmed = address.trim();
  if (!trimmed) {
    return { addressLines: [], regionCode: "US" };
  }

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1 && COUNTRY_LIKE.test(parts[parts.length - 1]!)) {
    parts.pop();
  }

  if (parts.length >= 3) {
    const last = parts[parts.length - 1]!;
    const zipOnly = last.match(/^(\d{5}(?:-\d{4})?)$/);
    if (zipOnly) {
      const state = normalizeStateToken(parts[parts.length - 2]!);
      const locality = parts[parts.length - 3]!;
      const street = parts.slice(0, -3).join(", ");
      return {
        addressLines: street ? [street] : [],
        locality,
        administrativeArea: state,
        postalCode: zipOnly[1],
        regionCode: "US",
      };
    }
  }

  if (parts.length >= 2) {
    const stateZip = parseStateZipSegment(parts[parts.length - 1]!);
    if (stateZip) {
      const locality = parts[parts.length - 2]!;
      const street = parts.slice(0, -2).join(", ");
      return {
        addressLines: street ? [street] : [],
        locality,
        administrativeArea: stateZip.state,
        postalCode: stateZip.postalCode,
        regionCode: "US",
      };
    }
  }

  if (parts.length === 2) {
    const stateZip = parseStateZipSegment(parts[1]!);
    if (stateZip) {
      return {
        addressLines: [parts[0]!],
        locality: "",
        administrativeArea: stateZip.state,
        postalCode: stateZip.postalCode,
        regionCode: "US",
      };
    }
  }

  return {
    addressLines: [trimmed],
    regionCode: "US",
  };
}

/** Build a GBP storefront address from onboarding text, optionally reusing structured fields. */
export function buildStorefrontAddressFromCanonical(
  canonical: string,
  existing?: GbpPostalAddress | null
): GbpPostalAddress {
  const parsed = parseUsPostalAddress(canonical);
  if (!existing) return parsed;

  return {
    regionCode: parsed.regionCode ?? existing.regionCode ?? "US",
    languageCode: existing.languageCode,
    addressLines: parsed.addressLines?.length ? parsed.addressLines : existing.addressLines,
    locality: parsed.locality || existing.locality,
    administrativeArea: parsed.administrativeArea || existing.administrativeArea,
    postalCode: parsed.postalCode || existing.postalCode,
  };
}
