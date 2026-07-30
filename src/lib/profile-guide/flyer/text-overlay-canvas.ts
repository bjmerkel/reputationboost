import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { FlyerDesignBrief } from "./design-brief";
import type { FlyerCopy } from "./copy";
import type { FlyerLayout } from "./formats";
import type { ArchetypeLayoutTokens } from "./layout-variants";

export interface CanvasTextOverlayInput {
  layout: FlyerLayout;
  tokens: ArchetypeLayoutTokens;
  brief: FlyerDesignBrief;
  copy: FlyerCopy;
  footer: string;
  eyebrow: string | null;
  address: string | null;
  showStars: boolean;
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

function formatEyebrow(value: string, tokens: ArchetypeLayoutTokens): string {
  const normalized = value
    .split(/[,|•/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" • ");

  if (tokens.eyebrowUppercase) {
    return normalized.toUpperCase();
  }

  return normalized;
}

export function renderFlyerTextOverlay(input: CanvasTextOverlayInput): Buffer {
  const { layout, tokens, brief, copy, footer, eyebrow, address, showStars } = input;
  const canvas = createCanvas(layout.width, layout.height);
  const ctx = canvas.getContext("2d");
  const centerX = layout.width / 2;
  const textWidth = layout.contentCardWidth - layout.contentCardPadding * 2;
  const headlineSize =
    brief.template === "bold" ? layout.headlineSize + 10 : layout.headlineSize;
  const textBottomLimit = layout.qrTop - 20;

  let y = layout.textTop;

  if (eyebrow) {
    ctx.font = `700 ${layout.eyebrowSize}px sans-serif`;
    ctx.fillStyle = brief.primaryColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const eyebrowText = truncate(formatEyebrow(eyebrow, tokens), 56);
    ctx.fillText(eyebrowText, centerX, y);
    y += layout.eyebrowSize + 10;
  }

  ctx.font = `${tokens.headlineWeight} ${headlineSize}px sans-serif`;
  ctx.fillStyle = brief.primaryColor;
  ctx.textAlign = "center";
  const headlineLines = wrapLines(ctx, truncate(copy.headline, 80), textWidth, 2);
  for (const line of headlineLines) {
    ctx.fillText(line, centerX, y);
    y += headlineSize + 8;
  }

  y += 6;
  ctx.font = `400 ${layout.subheadSize}px sans-serif`;
  ctx.fillStyle = "#5f6368";
  const subheadLines = wrapLines(ctx, truncate(copy.subhead, 140), textWidth, 3);
  for (const line of subheadLines) {
    ctx.fillText(line, centerX, y);
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
      ctx.font = `600 ${Math.round(layout.subheadSize * 1.05)}px sans-serif`;
      ctx.fillStyle = "#b06000";
      ctx.fillText(starLine, centerX, y + badgeHeight * 0.28);
      y += badgeHeight + 8;
    } else {
      ctx.font = `600 ${Math.round(layout.subheadSize * 1.08)}px sans-serif`;
      ctx.fillStyle = "#f9ab00";
      ctx.fillText(starLine, centerX, y);
      y += layout.subheadSize * 1.2 + 6;
    }
  }

  if (copy.supportLine?.trim() && y < textBottomLimit - 24) {
    ctx.font = `600 ${layout.supportLineSize}px sans-serif`;
    ctx.fillStyle = "#3c4043";
    ctx.fillText(truncate(copy.supportLine, 72), centerX, y);
    y += layout.supportLineSize + 8;
  }

  if (address && y < textBottomLimit - 20) {
    ctx.font = `400 ${layout.addressSize}px sans-serif`;
    ctx.fillStyle = "#80868b";
    ctx.fillText(truncate(address, 64), centerX, y);
  }

  const qrLabelY = layout.qrTop + layout.qrCardSize + Math.round(layout.qrLabelSize * 1.35);
  ctx.font = `600 ${layout.qrLabelSize}px sans-serif`;
  ctx.fillStyle = "#202124";
  ctx.fillText(truncate(copy.qrLabel, 56), centerX, qrLabelY);

  const ctaY = qrLabelY + layout.qrLabelSize + 18;
  ctx.font = `500 ${layout.ctaSize}px sans-serif`;
  ctx.fillStyle = "#3c4043";
  const ctaLines = wrapLines(ctx, truncate(copy.cta, 100), textWidth, 2);
  for (const line of ctaLines) {
    ctx.fillText(line, centerX, ctaY);
    y = ctaY + layout.ctaSize + 6;
  }

  const footerY = Math.min(
    layout.contentCardTop + layout.contentCardHeight - layout.contentCardPadding,
    (ctaLines.length > 1 ? ctaY + layout.ctaSize * 2 : ctaY + layout.ctaSize) + 24
  );
  ctx.font = `400 ${layout.footerSize}px sans-serif`;
  ctx.fillStyle = "#80868b";
  ctx.fillText(truncate(footer, 72), centerX, footerY);

  return canvas.toBuffer("image/png");
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
