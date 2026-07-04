export type NapDriftFieldName = "title" | "phone" | "website" | "address";

export interface NapDriftField {
  field: NapDriftFieldName;
  label: string;
  canonical: string;
  live: string;
}

export interface NapCanonical {
  name: string;
  phone: string;
  website: string;
  address: string;
}

export interface NapLive {
  title?: string;
  phone?: string;
  website?: string;
  address?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function websitesMatch(a: string, b: string): boolean {
  const clean = (url: string) =>
    url
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");
  if (!a || !b) return !a && !b;
  return clean(a) === clean(b);
}

/** Compare canonical business NAP (onboarding/client) vs live GBP profile. */
export function compareNap(canonical: NapCanonical, live: NapLive): NapDriftField[] {
  const drifts: NapDriftField[] = [];

  if (
    canonical.name &&
    live.title &&
    normalizeText(canonical.name) !== normalizeText(live.title)
  ) {
    drifts.push({
      field: "title",
      label: "Business name",
      canonical: canonical.name,
      live: live.title,
    });
  }

  if (
    canonical.phone &&
    live.phone &&
    normalizePhone(canonical.phone) !== normalizePhone(live.phone)
  ) {
    drifts.push({
      field: "phone",
      label: "Phone number",
      canonical: canonical.phone,
      live: live.phone,
    });
  }

  if (
    canonical.website &&
    live.website &&
    !websitesMatch(canonical.website, live.website)
  ) {
    drifts.push({
      field: "website",
      label: "Website",
      canonical: canonical.website,
      live: live.website,
    });
  }

  if (canonical.address && live.address) {
    const canonNorm = normalizeText(canonical.address);
    const liveNorm = normalizeText(live.address);
    if (!liveNorm.includes(canonNorm.slice(0, 12)) && !canonNorm.includes(liveNorm.slice(0, 12))) {
      drifts.push({
        field: "address",
        label: "Address",
        canonical: canonical.address,
        live: live.address,
      });
    }
  }

  return drifts;
}

export function napDriftGapId(field: NapDriftFieldName): string {
  return `nap-drift-${field}`;
}
