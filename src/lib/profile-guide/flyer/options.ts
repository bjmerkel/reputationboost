export interface FlyerDisplayOptions {
  showPhone: boolean;
  showStars: boolean;
  showAddress: boolean;
  showTagline: boolean;
}

export const DEFAULT_FLYER_DISPLAY_OPTIONS: FlyerDisplayOptions = {
  showPhone: true,
  showStars: true,
  showAddress: false,
  showTagline: true,
};

export function parseFlyerDisplayOptions(value: unknown): FlyerDisplayOptions {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_FLYER_DISPLAY_OPTIONS };
  }

  const record = value as Record<string, unknown>;
  return {
    showPhone: record.showPhone !== false,
    showStars: record.showStars !== false,
    showAddress: record.showAddress === true,
    showTagline: record.showTagline !== false,
  };
}

export function buildFlyerFooter(
  input: {
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    publicUrl: string;
  },
  options: FlyerDisplayOptions
): string {
  const parts: string[] = [];
  if (options.showPhone && input.phone?.trim()) {
    parts.push(input.phone.trim());
  }
  if (options.showAddress && input.address?.trim()) {
    parts.push(input.address.trim());
  }
  if (parts.length > 0) {
    return parts.join(" · ");
  }
  return input.website?.trim() || input.publicUrl;
}
