const SERVES_PREFIX = /^Serves\s+/i;

export function stripServesPrefix(text: string): string {
  return text.replace(SERVES_PREFIX, "").trim();
}

export function parseCityStateFromAreaText(text: string): {
  city: string;
  state: string;
  zip: string;
} {
  const cleaned = stripServesPrefix(text);
  if (!cleaned) return { city: "", state: "", zip: "" };

  const commaMatch = cleaned.match(/^([^,]+),\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?/);
  if (commaMatch) {
    return {
      city: commaMatch[1].trim(),
      state: commaMatch[2].toUpperCase(),
      zip: commaMatch[3] ?? "",
    };
  }

  return { city: cleaned, state: "", zip: "" };
}

export function resolveServiceAreaLabel(
  ...candidates: Array<string | undefined | null>
): string {
  for (const raw of candidates) {
    const label = stripServesPrefix(raw?.trim() ?? "");
    if (label) return label;
  }
  return "";
}

export function detectServiceAreaBusiness(input: {
  isPureServiceAreaBusiness?: boolean | null;
  hasStreet: boolean;
  serviceAreaLabel: string;
}): boolean {
  if (input.isPureServiceAreaBusiness === true) return true;
  if (input.isPureServiceAreaBusiness === false) return false;
  return !input.hasStreet && Boolean(input.serviceAreaLabel);
}

export function buildBusinessAddress(input: {
  street: string;
  formattedAddress: string;
  serviceAreaLabel: string;
  isServiceAreaBusiness: boolean;
}): string {
  if (input.street) return input.street;
  if (input.isServiceAreaBusiness && input.serviceAreaLabel) return input.serviceAreaLabel;
  return input.formattedAddress || input.serviceAreaLabel;
}
