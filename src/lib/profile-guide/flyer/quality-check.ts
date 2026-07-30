import type { FlyerCopy } from "./copy";
import type { FlyerDesignBrief } from "./design-brief";
import { computeFlyerLayout, getFlyerFormatSpec } from "./formats";

export type FlyerQualityWarningCode = "qr_low_contrast" | "text_near_qr_zone";

export interface FlyerQualityReport {
  warnings: FlyerQualityWarningCode[];
  messages: string[];
}

const QUALITY_WARNING_MESSAGES: Record<FlyerQualityWarningCode, string> = {
  qr_low_contrast:
    "QR code contrast may be low against the white frame. Try a darker brand color for better scannability.",
  text_near_qr_zone:
    "Flyer copy is crowded near the QR code. Shorten the headline or disable extra lines.",
};

export function flyerQualityMessagesFromWarnings(
  warnings: FlyerQualityWarningCode[]
): string[] {
  return warnings.map((warning) => QUALITY_WARNING_MESSAGES[warning]);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16) || 26,
    g: parseInt(normalized.slice(2, 4), 16) || 115,
    b: parseInt(normalized.slice(4, 6), 16) || 232,
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const fg = hexToRgb(foregroundHex);
  const bg = hexToRgb(backgroundHex);
  const fgLum = relativeLuminance(fg.r, fg.g, fg.b);
  const bgLum = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function wrapLineCount(text: string, maxChars: number, maxLines: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 0;
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines += 1;
    current = word;
    if (lines >= maxLines - 1) break;
  }

  if (current && lines < maxLines) lines += 1;
  return Math.min(lines, maxLines);
}

function estimatePortraitTextBottom(input: {
  brief: FlyerDesignBrief;
  copy: FlyerCopy;
  layout: ReturnType<typeof computeFlyerLayout>;
}): number {
  const { brief, copy, layout } = input;
  let y = layout.textTop;

  y += layout.eyebrowSize + 14;
  y += layout.businessNameSize + 12;

  const headlineLines = wrapLineCount(copy.headline, layout.headlineMaxChars, 2);
  y += headlineLines * (layout.headlineSize + 6) + 4;

  const subheadLines = wrapLineCount(copy.subhead, layout.subheadMaxChars, 2);
  y += subheadLines * (layout.subheadSize + 4);

  if (copy.supportLine?.trim()) {
    y += layout.supportLineSize + 12;
  }

  if (brief.displayOptions.showAddress && brief.address?.trim()) {
    y += layout.addressSize + 8;
  }

  if (brief.displayOptions.showStars) {
    y += layout.subheadSize + 16;
  }

  return y;
}

export function checkFlyerQuality(input: {
  brief: FlyerDesignBrief;
  copy: FlyerCopy;
  layout?: ReturnType<typeof computeFlyerLayout>;
}): FlyerQualityReport {
  const warnings: FlyerQualityWarningCode[] = [];
  const messages: string[] = [];
  const layout = input.layout ?? computeFlyerLayout(getFlyerFormatSpec(input.brief.format));

  const qrContrast = contrastRatio(input.brief.primaryColor, "#ffffff");
  if (qrContrast < 4.5) {
    warnings.push("qr_low_contrast");
    messages.push(QUALITY_WARNING_MESSAGES.qr_low_contrast);
  }

  if (layout.orientation === "portrait") {
    const textBottom = estimatePortraitTextBottom({
      brief: input.brief,
      copy: input.copy,
      layout,
    });
    const clearance = layout.qrTop - textBottom;
    if (clearance < 24) {
      warnings.push("text_near_qr_zone");
      messages.push(QUALITY_WARNING_MESSAGES.text_near_qr_zone);
    }
  }

  return { warnings, messages };
}
