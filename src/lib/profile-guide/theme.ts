export const PROFILE_GUIDE_BUTTON_STYLES = ["rounded", "pill", "square"] as const;
export type ProfileGuideButtonStyle = (typeof PROFILE_GUIDE_BUTTON_STYLES)[number];

export const PROFILE_GUIDE_FONT_PRESETS = ["professional", "friendly", "bold"] as const;
export type ProfileGuideFontPreset = (typeof PROFILE_GUIDE_FONT_PRESETS)[number];

export const PROFILE_GUIDE_FLYER_TEMPLATES = ["professional", "friendly", "bold"] as const;
export type ProfileGuideFlyerTemplate = (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number];

export const FONT_PRESET_STYLES: Record<
  ProfileGuideFontPreset,
  { heading: string; body: string }
> = {
  professional: {
    heading: "Georgia, 'Times New Roman', serif",
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  friendly: {
    heading: "'Trebuchet MS', 'Lucida Grande', sans-serif",
    body: "Verdana, Geneva, sans-serif",
  },
  bold: {
    heading: "Impact, 'Arial Black', sans-serif",
    body: "Arial, Helvetica, sans-serif",
  },
};

export function buttonRadiusClass(style: ProfileGuideButtonStyle): string {
  switch (style) {
    case "pill":
      return "rounded-full";
    case "square":
      return "rounded-md";
    default:
      return "rounded-xl";
  }
}

export function buildTextUsUrl(phone: string, message?: string | null): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const base = `sms:${trimmed}`;
  const body = message?.trim();
  return body ? `${base}?body=${encodeURIComponent(body)}` : base;
}
