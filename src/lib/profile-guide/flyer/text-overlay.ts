import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FlyerDesignBrief } from "./design-brief";
import type { FlyerCopy } from "./copy";
import type { FlyerLayout } from "./formats";
import { FLYER_QR_PRESENTATION_PAD } from "./formats";
import type { ArchetypeLayoutTokens } from "./layout-variants";

export interface FlyerTextOverlayInput {
  layout: FlyerLayout;
  tokens: ArchetypeLayoutTokens;
  brief: FlyerDesignBrief;
  copy: FlyerCopy;
  footer: string;
  eyebrow: string | null;
  address: string | null;
  showStars: boolean;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const FONT_FAMILY = "FlyerDejaVuSans";
const FONT_FAMILY_BOLD = "FlyerDejaVuSans-Bold";

let fontsRegistered = false;

function ensureFontsRegistered(): void {
  if (fontsRegistered) return;

  GlobalFonts.registerFromPath(
    join(moduleDir, "fonts", "DejaVuSans.ttf"),
    FONT_FAMILY
  );
  GlobalFonts.registerFromPath(
    join(moduleDir, "fonts", "DejaVuSans-Bold.ttf"),
    FONT_FAMILY_BOLD
  );

  fontsRegistered = true;
}

function fontFamily(weight: "regular" | "bold"): string {
  return weight === "bold" ? FONT_FAMILY_BOLD : FONT_FAMILY;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function wrapLines(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function formatEyebrow(value: string, tokens: ArchetypeLayoutTokens): string {
  const normalized = value
    .split(/[,|•/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" • ");

  return tokens.eyebrowUppercase ? normalized.toUpperCase() : normalized;
}

function buildStarLine(
  tokens: ArchetypeLayoutTokens,
  showStars: boolean,
  averageRating?: number | null,
  reviewCount?: number | null
): string | null {
  if (!showStars) return null;

  if (tokens.starStyle === "badge" && averageRating != null) {
    return `★★★★★ ${averageRating.toFixed(1)} on Google`;
  }

  if (tokens.showRatingInStars && averageRating != null && reviewCount != null && reviewCount > 0) {
    return `★★★★★ ${averageRating.toFixed(1)} on Google · ${reviewCount} reviews`;
  }

  if (averageRating != null && reviewCount != null && reviewCount > 0) {
    return `★★★★★ ${averageRating.toFixed(1)} on Google · ${reviewCount} reviews`;
  }

  return "★★★★★";
}

function drawCenteredText(
  ctx: SKRSContext2D,
  text: string,
  centerX: number,
  y: number,
  options: {
    size: number;
    weight: "regular" | "bold";
    fill: string;
    stroke?: string;
    strokeWidth?: number;
  }
): void {
  ctx.font = `${options.weight === "bold" ? "700" : "400"} ${options.size}px ${fontFamily(options.weight)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  if (options.stroke && (options.strokeWidth ?? 0) > 0) {
    ctx.lineWidth = options.strokeWidth ?? 4;
    ctx.strokeStyle = options.stroke;
    ctx.strokeText(text, centerX, y);
  }

  ctx.fillStyle = options.fill;
  ctx.fillText(text, centerX, y);
}

function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPortraitOverlay(
  ctx: SKRSContext2D,
  input: FlyerTextOverlayInput
): void {
  const { layout, tokens, brief, copy, footer, eyebrow, address, showStars } = input;
  const centerX = layout.width / 2;
  const textWidth = layout.contentCardWidth - layout.contentCardPadding * 2;
  const headlineSize =
    brief.template === "bold" ? layout.headlineSize + 10 : layout.headlineSize;
  const textBottomLimit = layout.qrTop - 20;

  let y = layout.textTop;

  if (eyebrow) {
    drawCenteredText(ctx, truncate(formatEyebrow(eyebrow, tokens), 56), centerX, y, {
      size: layout.eyebrowSize,
      weight: "bold",
      fill: brief.primaryColor,
      stroke: "#ffffff",
      strokeWidth: 4,
    });
    y += layout.eyebrowSize + 10;
  }

  drawCenteredText(ctx, truncate(brief.businessName, 48), centerX, y, {
    size: layout.businessNameSize,
    weight: tokens.businessNameWeight >= 700 ? "bold" : "regular",
    fill: "#202124",
    stroke: "#ffffff",
    strokeWidth: 4,
  });
  y += layout.businessNameSize + 8;

  ctx.font = `${tokens.headlineWeight} ${headlineSize}px ${fontFamily(tokens.headlineWeight >= 700 ? "bold" : "regular")}`;
  const headlineLines = wrapLines(ctx, truncate(copy.headline, 80), textWidth, 2);
  for (const line of headlineLines) {
    drawCenteredText(ctx, line, centerX, y, {
      size: headlineSize,
      weight: tokens.headlineWeight >= 700 ? "bold" : "regular",
      fill: brief.primaryColor,
      stroke: "#ffffff",
      strokeWidth: 6,
    });
    y += headlineSize + 8;
  }

  y += 6;
  ctx.font = `400 ${layout.subheadSize}px ${fontFamily("regular")}`;
  const subheadLines = wrapLines(ctx, truncate(copy.subhead, 140), textWidth, 3);
  for (const line of subheadLines) {
    drawCenteredText(ctx, line, centerX, y, {
      size: layout.subheadSize,
      weight: "regular",
      fill: "#3c4043",
      stroke: "#ffffff",
      strokeWidth: 4,
    });
    y += layout.subheadSize + 6;
  }

  const starLine = buildStarLine(tokens, showStars, brief.averageRating, brief.reviewCount);
  if (starLine && y < textBottomLimit - 36) {
    y += 10;
    if (tokens.starStyle === "badge") {
      const badgeWidth = Math.min(textWidth, layout.contentCardWidth * 0.72);
      const badgeX = centerX - badgeWidth / 2;
      const badgeHeight = layout.subheadSize * 1.6;
      ctx.fillStyle = "#fff8e1";
      roundRect(ctx, badgeX, y, badgeWidth, badgeHeight, 12);
      ctx.fill();
      drawCenteredText(ctx, starLine, centerX, y + badgeHeight * 0.28, {
        size: Math.round(layout.subheadSize * 1.05),
        weight: "bold",
        fill: "#b06000",
      });
      y += badgeHeight + 8;
    } else {
      drawCenteredText(ctx, starLine, centerX, y, {
        size: Math.round(layout.subheadSize * 1.08),
        weight: "bold",
        fill: "#f9ab00",
        stroke: "#ffffff",
        strokeWidth: 3,
      });
      y += layout.subheadSize * 1.2 + 6;
    }
  }

  if (copy.supportLine?.trim() && y < textBottomLimit - 24) {
    drawCenteredText(ctx, truncate(copy.supportLine, 72), centerX, y, {
      size: layout.supportLineSize,
      weight: "bold",
      fill: "#202124",
      stroke: "#ffffff",
      strokeWidth: 4,
    });
    y += layout.supportLineSize + 8;
  }

  if (address && y < textBottomLimit - 20) {
    drawCenteredText(ctx, truncate(address, 64), centerX, y, {
      size: layout.addressSize,
      weight: "regular",
      fill: "#5f6368",
      stroke: "#ffffff",
      strokeWidth: 3,
    });
  }

  const qrLabelY =
    layout.qrTop + layout.qrCardSize + FLYER_QR_PRESENTATION_PAD + Math.round(layout.qrLabelSize * 0.9);
  drawCenteredText(ctx, truncate(copy.qrLabel, 56), centerX, qrLabelY, {
    size: layout.qrLabelSize,
    weight: "bold",
    fill: "#202124",
    stroke: "#ffffff",
    strokeWidth: 4,
  });

  const ctaY = qrLabelY + layout.qrLabelSize + 18;
  ctx.font = `400 ${layout.ctaSize}px ${fontFamily("regular")}`;
  const ctaLines = wrapLines(ctx, truncate(copy.cta, 100), textWidth, 2);
  let ctaLineY = ctaY;
  for (const line of ctaLines) {
    drawCenteredText(ctx, line, centerX, ctaLineY, {
      size: layout.ctaSize,
      weight: "regular",
      fill: "#3c4043",
      stroke: "#ffffff",
      strokeWidth: 4,
    });
    ctaLineY += layout.ctaSize + 6;
  }

  const footerY = Math.min(
    layout.contentCardTop + layout.contentCardHeight - layout.contentCardPadding,
    ctaLineY + 12
  );
  drawCenteredText(ctx, truncate(footer, 72), centerX, footerY, {
    size: layout.footerSize,
    weight: "regular",
    fill: "#5f6368",
    stroke: "#ffffff",
    strokeWidth: 3,
  });
}

function drawLandscapeOverlay(
  ctx: SKRSContext2D,
  input: FlyerTextOverlayInput
): void {
  const { layout, tokens, brief, copy, footer, eyebrow, address, showStars } = input;
  const textX = layout.contentCardLeft + layout.contentCardPadding;
  const textWidth = layout.contentCardWidth - layout.contentCardPadding * 2;
  const centerX = textX + Math.round(textWidth / 2);
  const qrLabelX = layout.qrLeft + Math.round(layout.qrCardSize / 2);
  const headlineSize =
    brief.template === "bold" ? layout.headlineSize + 8 : layout.headlineSize;

  let y = layout.textTop;

  if (eyebrow) {
    drawCenteredText(ctx, truncate(formatEyebrow(eyebrow, tokens), 44), centerX, y, {
      size: layout.eyebrowSize,
      weight: "bold",
      fill: brief.primaryColor,
      stroke: "#ffffff",
      strokeWidth: 4,
    });
    y += layout.eyebrowSize + 10;
  }

  drawCenteredText(ctx, truncate(brief.businessName, 40), centerX, y, {
    size: layout.businessNameSize,
    weight: tokens.businessNameWeight >= 700 ? "bold" : "regular",
    fill: "#202124",
    stroke: "#ffffff",
    strokeWidth: 4,
  });
  y += layout.businessNameSize + 8;

  ctx.font = `${tokens.headlineWeight} ${headlineSize}px ${fontFamily(tokens.headlineWeight >= 700 ? "bold" : "regular")}`;
  const headlineLines = wrapLines(ctx, truncate(copy.headline, 80), textWidth, 2);
  for (const line of headlineLines) {
    drawCenteredText(ctx, line, centerX, y, {
      size: headlineSize,
      weight: tokens.headlineWeight >= 700 ? "bold" : "regular",
      fill: brief.primaryColor,
      stroke: "#ffffff",
      strokeWidth: 6,
    });
    y += headlineSize + 6;
  }

  ctx.font = `400 ${layout.subheadSize}px ${fontFamily("regular")}`;
  const subheadLines = wrapLines(ctx, truncate(copy.subhead, 120), textWidth, 2);
  for (const line of subheadLines) {
    drawCenteredText(ctx, line, centerX, y + 4, {
      size: layout.subheadSize,
      weight: "regular",
      fill: "#3c4043",
      stroke: "#ffffff",
      strokeWidth: 4,
    });
    y += layout.subheadSize + 4;
  }

  if (copy.supportLine?.trim()) {
    drawCenteredText(ctx, truncate(copy.supportLine, 60), centerX, y + 4, {
      size: layout.supportLineSize,
      weight: "bold",
      fill: "#202124",
      stroke: "#ffffff",
      strokeWidth: 4,
    });
    y += layout.supportLineSize + 8;
  }

  if (address) {
    drawCenteredText(ctx, truncate(address, 56), centerX, y + 2, {
      size: layout.addressSize,
      weight: "regular",
      fill: "#5f6368",
      stroke: "#ffffff",
      strokeWidth: 3,
    });
    y += layout.addressSize + 6;
  }

  const starLine = buildStarLine(tokens, showStars, brief.averageRating, brief.reviewCount);
  if (starLine) {
    drawCenteredText(ctx, starLine, centerX, y + 8, {
      size: Math.round(layout.subheadSize * 1.05),
      weight: "bold",
      fill: "#f9ab00",
      stroke: "#ffffff",
      strokeWidth: 3,
    });
    y += layout.subheadSize * 1.2 + 8;
  }

  const ctaY = Math.min(
    layout.contentCardTop + layout.contentCardHeight - layout.contentCardPadding - 48,
    y + 16
  );
  drawCenteredText(ctx, truncate(copy.cta, 64), centerX, ctaY, {
    size: layout.ctaSize,
    weight: "regular",
    fill: "#3c4043",
    stroke: "#ffffff",
    strokeWidth: 4,
  });

  const footerY = layout.contentCardTop + layout.contentCardHeight - layout.contentCardPadding;
  drawCenteredText(ctx, truncate(footer, 56), centerX, footerY, {
    size: layout.footerSize,
    weight: "regular",
    fill: "#5f6368",
    stroke: "#ffffff",
    strokeWidth: 3,
  });

  const qrLabelY =
    layout.qrTop + layout.qrCardSize + FLYER_QR_PRESENTATION_PAD + Math.round(layout.qrLabelSize * 0.85);
  drawCenteredText(ctx, truncate(copy.qrLabel, 40), qrLabelX, qrLabelY, {
    size: layout.qrLabelSize,
    weight: "bold",
    fill: "#202124",
    stroke: "#ffffff",
    strokeWidth: 4,
  });
}

export function renderFlyerTextOverlay(input: FlyerTextOverlayInput): Buffer {
  ensureFontsRegistered();

  const canvas = createCanvas(input.layout.width, input.layout.height);
  const ctx = canvas.getContext("2d");

  if (input.layout.orientation === "landscape") {
    drawLandscapeOverlay(ctx, input);
  } else {
    drawPortraitOverlay(ctx, input);
  }

  return canvas.toBuffer("image/png");
}

export function verifyFlyerFontsAvailable(): boolean {
  try {
    ensureFontsRegistered();
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext("2d");
    ctx.font = `24px ${FONT_FAMILY}`;
    ctx.fillText("Test", 4, 20);
    const { data } = ctx.getImageData(4, 8, 40, 20);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && data[i] < 250) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Preload fonts at module init so failures surface early in logs.
try {
  readFileSync(join(moduleDir, "fonts", "DejaVuSans.ttf"));
  ensureFontsRegistered();
} catch {
  // Font files are copied into the server trace via next.config outputFileTracingIncludes.
}
