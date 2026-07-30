import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";
import type { FlyerDesignBrief } from "./design-brief";
import { buildFlyerEyebrow, buildFlyerSupportLine } from "./context";
import { resolveFlyerCopy } from "./copy";
import { computeFlyerLayout, getFlyerFormatSpec, type FlyerLayout } from "./formats";
import {
  getArchetypeLayoutTokens,
  type ArchetypeLayoutTokens,
} from "./layout-variants";
import { buildFlyerFooter } from "./options";

export interface CompositeFlyerInput {
  brief: FlyerDesignBrief;
  background: Buffer;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
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

async function loadImageBuffer(source?: string | null): Promise<Buffer | null> {
  if (!source?.trim()) return null;

  if (source.startsWith("data:")) {
    const comma = source.indexOf(",");
    if (comma < 0) return null;
    return Buffer.from(source.slice(comma + 1), "base64");
  }

  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function wrapSvgLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
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

function effectiveCoverHeight(layout: FlyerLayout, tokens: ArchetypeLayoutTokens): number {
  if (tokens.coverTreatment === "none") return 0;
  return Math.round(layout.coverHeight * tokens.coverHeightRatio);
}

function effectiveCardRadius(layout: FlyerLayout, tokens: ArchetypeLayoutTokens): number {
  return Math.round(layout.contentCardRadius * tokens.cardRadiusScale);
}

function buildContentCardSvg(
  layout: FlyerLayout,
  tokens: ArchetypeLayoutTokens,
  primaryColor: string
): Buffer {
  const {
    contentCardLeft,
    contentCardTop,
    contentCardWidth,
    contentCardHeight,
  } = layout;
  const radius = effectiveCardRadius(layout, tokens);
  const shadowOpacity = tokens.cardStyle === "glass-panel" ? 0.08 : 0.12;
  const fillOpacity = tokens.cardFillOpacity;
  const border = tokens.cardBorderColor
    ? `stroke="${escapeXml(tokens.cardBorderColor)}" stroke-width="2"`
    : "";

  const parts = [
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<filter id="cardShadow" x="-8%" y="-4%" width="116%" height="112%">`,
    `<feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="${shadowOpacity}"/>`,
    `</filter>`,
    `</defs>`,
  ];

  if (tokens.accentBarStyle === "diagonal") {
    parts.push(
      `<polygon points="${contentCardLeft},${contentCardTop + contentCardHeight} ${contentCardLeft + contentCardWidth},${contentCardTop} ${contentCardLeft + contentCardWidth},${contentCardTop + Math.round(contentCardHeight * 0.18)}" fill="${escapeXml(primaryColor)}" fill-opacity="0.12"/>`
    );
  }

  parts.push(
    `<rect x="${contentCardLeft}" y="${contentCardTop}" width="${contentCardWidth}" height="${contentCardHeight}" rx="${radius}" ry="${radius}" fill="#ffffff" fill-opacity="${fillOpacity}" filter="url(#cardShadow)" ${border}/>`
  );

  if (tokens.accentBarStyle === "top") {
    const barWidth = Math.round(contentCardWidth * 0.22);
    const barX = contentCardLeft + Math.round((contentCardWidth - barWidth) / 2);
    parts.push(
      `<rect x="${barX}" y="${contentCardTop + 18}" width="${barWidth}" height="5" rx="2.5" fill="${escapeXml(primaryColor)}"/>`
    );
  }

  parts.push("</svg>");
  return Buffer.from(parts.join(""));
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
    return `★★★★★ ${averageRating.toFixed(1)} · ${reviewCount} reviews`;
  }

  return "★★★★★";
}

interface TextOverlayInput {
  layout: FlyerLayout;
  tokens: ArchetypeLayoutTokens;
  businessName: string;
  eyebrow: string | null;
  headline: string;
  subhead: string;
  supportLine: string;
  address: string | null;
  qrLabel: string;
  cta: string;
  footer: string;
  primaryColor: string;
  template: FlyerDesignBrief["template"];
  showStars: boolean;
  averageRating?: number | null;
  reviewCount?: number | null;
  qrTop: number;
  qrLeft: number;
  qrCardSize: number;
}

function appendCenteredText(
  parts: string[],
  centerX: number,
  y: number,
  text: string,
  size: number,
  options: { weight?: number; fill?: string; letterSpacing?: number; uppercase?: boolean } = {}
): number {
  const weight = options.weight ?? 400;
  const fill = options.fill ?? "#5f6368";
  const letterSpacing = options.letterSpacing ?? 0;
  const displayText = options.uppercase ? text.toUpperCase() : text;

  parts.push(
    `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${escapeXml(fill)}"${letterSpacing ? ` letter-spacing="${letterSpacing}"` : ""}>${escapeXml(displayText)}</text>`
  );

  return y + size + 10;
}

function buildPortraitTextOverlaySvg(input: TextOverlayInput): Buffer {
  const { layout, tokens } = input;
  const headlineSize =
    input.template === "bold" ? layout.headlineSize + 10 : layout.headlineSize;
  const centerX = Math.round(layout.width / 2);
  const textBottomLimit = input.qrTop - 16;
  const starLine = buildStarLine(
    tokens,
    input.showStars,
    input.averageRating,
    input.reviewCount
  );

  const headlineLines = wrapSvgLines(input.headline, layout.headlineMaxChars, 2);
  const subheadLines = wrapSvgLines(input.subhead, layout.subheadMaxChars, 2);

  let y = layout.textTop;
  const parts: string[] = [
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="100%" height="100%" fill="none"/>`,
  ];

  if (input.eyebrow) {
    y = appendCenteredText(parts, centerX, y, truncate(input.eyebrow, 56), layout.eyebrowSize, {
      weight: 700,
      fill: input.primaryColor,
      letterSpacing: tokens.eyebrowUppercase ? 1.2 : 0.6,
      uppercase: tokens.eyebrowUppercase,
    });
    y += 4;
  }

  y = appendCenteredText(
    parts,
    centerX,
    y,
    truncate(input.businessName, 48),
    layout.businessNameSize,
    { weight: tokens.businessNameWeight, fill: "#202124" }
  );
  y += 6;

  for (const line of headlineLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="${tokens.headlineWeight}" fill="${escapeXml(input.primaryColor)}">${escapeXml(line)}</text>`
    );
    y += headlineSize + 6;
  }

  y += 4;
  for (const line of subheadLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.subheadSize}" fill="#5f6368">${escapeXml(line)}</text>`
    );
    y += layout.subheadSize + 4;
  }

  if (input.supportLine) {
    y += 4;
    y = appendCenteredText(
      parts,
      centerX,
      y,
      truncate(input.supportLine, 72),
      layout.supportLineSize,
      { weight: 600, fill: "#3c4043" }
    );
  }

  if (input.address) {
    y += 2;
    y = appendCenteredText(
      parts,
      centerX,
      y,
      truncate(input.address, 64),
      layout.addressSize,
      { fill: "#80868b" }
    );
  }

  if (starLine && y < textBottomLimit - 28) {
    y += 6;
    if (tokens.starStyle === "badge") {
      const badgeWidth = Math.round(layout.contentCardWidth * 0.62);
      const badgeX = centerX - Math.round(badgeWidth / 2);
      parts.push(
        `<rect x="${badgeX}" y="${y - Math.round(layout.subheadSize * 0.9)}" width="${badgeWidth}" height="${Math.round(layout.subheadSize * 1.5)}" rx="12" fill="#fff8e1"/>`,
        `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(layout.subheadSize * 1.05)}" font-weight="600" fill="#b06000">${escapeXml(starLine)}</text>`
      );
      y += Math.round(layout.subheadSize * 1.15) + 4;
    } else {
      parts.push(
        `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(layout.subheadSize * 1.05)}" font-weight="600" fill="#f9ab00">${escapeXml(starLine)}</text>`
      );
      y += Math.round(layout.subheadSize * 1.05) + 4;
    }
  }

  const qrLabelY = input.qrTop + input.qrCardSize + Math.round(layout.qrLabelSize * 1.4);
  appendCenteredText(parts, centerX, qrLabelY, truncate(input.qrLabel, 56), layout.qrLabelSize, {
    weight: 600,
    fill: "#3c4043",
  });

  const ctaY = qrLabelY + layout.qrLabelSize + 22;
  appendCenteredText(parts, centerX, ctaY, truncate(input.cta, 80), layout.ctaSize, {
    fill: "#3c4043",
  });

  const footerY = Math.min(
    layout.contentCardTop + layout.contentCardHeight - layout.contentCardPadding,
    ctaY + layout.ctaSize + 28
  );
  appendCenteredText(parts, centerX, footerY, truncate(input.footer, 72), layout.footerSize, {
    fill: "#80868b",
  });

  parts.push("</svg>");
  return Buffer.from(parts.join(""));
}

function buildLandscapeTextOverlaySvg(input: TextOverlayInput): Buffer {
  const { layout, tokens } = input;
  const headlineSize =
    input.template === "bold" ? layout.headlineSize + 8 : layout.headlineSize;
  const textX = layout.contentCardLeft + layout.contentCardPadding;
  const textWidth = layout.contentCardWidth - layout.contentCardPadding * 2;
  const centerX = textX + Math.round(textWidth / 2);
  const qrLabelX = input.qrLeft + Math.round(input.qrCardSize / 2);
  const starLine = buildStarLine(
    tokens,
    input.showStars,
    input.averageRating,
    input.reviewCount
  );

  const headlineLines = wrapSvgLines(input.headline, layout.headlineMaxChars, 2);
  const subheadLines = wrapSvgLines(input.subhead, layout.subheadMaxChars, 2);

  let y = layout.textTop;
  const parts: string[] = [
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="100%" height="100%" fill="none"/>`,
  ];

  if (input.eyebrow) {
    y = appendCenteredText(parts, centerX, y, truncate(input.eyebrow, 44), layout.eyebrowSize, {
      weight: 700,
      fill: input.primaryColor,
      letterSpacing: tokens.eyebrowUppercase ? 1.2 : 0.6,
      uppercase: tokens.eyebrowUppercase,
    });
    y += 4;
  }

  y = appendCenteredText(
    parts,
    centerX,
    y,
    truncate(input.businessName, 40),
    layout.businessNameSize,
    { weight: tokens.businessNameWeight, fill: "#202124" }
  );
  y += 6;

  for (const line of headlineLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="${tokens.headlineWeight}" fill="${escapeXml(input.primaryColor)}">${escapeXml(line)}</text>`
    );
    y += headlineSize + 6;
  }

  y += 4;
  for (const line of subheadLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.subheadSize}" fill="#5f6368">${escapeXml(line)}</text>`
    );
    y += layout.subheadSize + 4;
  }

  if (input.supportLine) {
    y += 4;
    y = appendCenteredText(
      parts,
      centerX,
      y,
      truncate(input.supportLine, 60),
      layout.supportLineSize,
      { weight: 600, fill: "#3c4043" }
    );
  }

  if (input.address) {
    y += 2;
    y = appendCenteredText(
      parts,
      centerX,
      y,
      truncate(input.address, 56),
      layout.addressSize,
      { fill: "#80868b" }
    );
  }

  if (starLine) {
    y += 8;
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(layout.subheadSize * 1.05)}" font-weight="600" fill="#f9ab00">${escapeXml(starLine)}</text>`
    );
    y += Math.round(layout.subheadSize * 1.05) + 8;
  }

  const ctaY = Math.min(
    layout.contentCardTop + layout.contentCardHeight - layout.contentCardPadding - 48,
    y + 16
  );
  appendCenteredText(parts, centerX, ctaY, truncate(input.cta, 64), layout.ctaSize, {
    fill: "#3c4043",
  });

  const footerY = layout.contentCardTop + layout.contentCardHeight - layout.contentCardPadding;
  appendCenteredText(parts, centerX, footerY, truncate(input.footer, 56), layout.footerSize, {
    fill: "#80868b",
  });

  const qrLabelY = input.qrTop + input.qrCardSize + Math.round(layout.qrLabelSize * 1.3);
  appendCenteredText(parts, qrLabelX, qrLabelY, truncate(input.qrLabel, 40), layout.qrLabelSize, {
    weight: 600,
    fill: "#3c4043",
  });

  parts.push("</svg>");
  return Buffer.from(parts.join(""));
}

async function buildQrCard(
  qrBuffer: Buffer,
  layout: FlyerLayout,
  tokens: ArchetypeLayoutTokens,
  primaryColor: string
): Promise<Buffer> {
  const padding = Math.round((layout.qrCardSize - layout.qrCodeSize) / 2);
  const ringWidth = tokens.qrFrame === "branded-ring" ? 5 : 0;
  const rgb = hexToRgb(primaryColor);

  if (tokens.qrFrame === "branded-ring") {
    const innerPadding = padding;
    return sharp({
      create: {
        width: layout.qrCardSize,
        height: layout.qrCardSize,
        channels: 4,
        background: { ...rgb, alpha: 1 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: layout.qrCardSize - ringWidth * 2,
              height: layout.qrCardSize - ringWidth * 2,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          top: ringWidth,
          left: ringWidth,
        },
        { input: qrBuffer, top: innerPadding, left: innerPadding },
      ])
      .png()
      .toBuffer();
  }

  return sharp({
    create: {
      width: layout.qrCardSize,
      height: layout.qrCardSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: qrBuffer, top: padding, left: padding }])
    .png()
    .toBuffer();
}

export async function compositeFlyerImage(input: CompositeFlyerInput): Promise<Buffer> {
  const { brief } = input;
  const tagline = brief.displayOptions.showTagline ? brief.tagline : null;
  const copy =
    brief.copy ??
    resolveFlyerCopy(brief.template, tagline, buildFlyerSupportLine(brief));
  const footer = buildFlyerFooter(brief, brief.displayOptions);
  const eyebrow = buildFlyerEyebrow(brief);
  const address =
    brief.displayOptions.showAddress && brief.address?.trim() ? brief.address.trim() : null;
  const format = getFlyerFormatSpec(brief.format);
  const layout = computeFlyerLayout(format);
  const tokens = getArchetypeLayoutTokens(brief.archetype);
  const showStars = brief.displayOptions.showStars;
  const coverHeight = effectiveCoverHeight(layout, tokens);

  const [logoBuffer, coverBuffer] = await Promise.all([
    loadImageBuffer(brief.logoUrl),
    loadImageBuffer(brief.coverImageUrl),
  ]);

  const qrBuffer = await QRCode.toBuffer(
    `${brief.publicUrl}?src=flyer-${brief.template}-${brief.format}`,
    {
      type: "png",
      width: layout.qrCodeSize,
      margin: 1,
      color: {
        dark: brief.primaryColor,
        light: "#ffffff",
      },
    }
  );

  const qrCard = await buildQrCard(qrBuffer, layout, tokens, brief.primaryColor);

  const background = await sharp(input.background)
    .resize(layout.width, layout.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const layers: OverlayOptions[] = [];

  if (coverBuffer && layout.orientation === "portrait" && coverHeight > 0) {
    const cover = await sharp(coverBuffer)
      .resize(layout.width, coverHeight, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    layers.push({ input: cover, top: 0, left: 0 });

    const fadeAlpha =
      tokens.coverTreatment === "full-bleed-fade"
        ? Math.min(tokens.coverFadeOpacity + 0.08, 0.5)
        : tokens.coverFadeOpacity;

    const coverFade = await sharp({
      create: {
        width: layout.width,
        height: coverHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: fadeAlpha },
      },
    })
      .png()
      .toBuffer();
    layers.push({ input: coverFade, top: 0, left: 0 });
  }

  layers.push({
    input: buildContentCardSvg(layout, tokens, brief.primaryColor),
    top: 0,
    left: 0,
  });

  if (logoBuffer) {
    const logo = await sharp(logoBuffer)
      .resize({
        width: layout.logoMaxWidth,
        height: layout.logoMaxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    const metadata = await sharp(logo).metadata();
    const logoWidth = metadata.width ?? layout.logoMaxWidth;
    const logoLeft =
      layout.orientation === "landscape"
        ? layout.contentCardLeft + layout.contentCardPadding
        : Math.round((layout.width - logoWidth) / 2);
    const logoTop =
      layout.orientation === "landscape"
        ? layout.logoTop
        : coverBuffer && coverHeight > 0
          ? Math.max(12, coverHeight - Math.round(layout.logoMaxHeight * 0.55))
          : layout.contentCardTop + layout.contentCardPadding;

    layers.push({
      input: logo,
      top: logoTop,
      left: logoLeft,
    });
  }

  layers.push({ input: qrCard, top: layout.qrTop, left: layout.qrLeft });

  const textOverlayInput: TextOverlayInput = {
    layout,
    tokens,
    businessName: brief.businessName,
    eyebrow,
    headline: copy.headline,
    subhead: copy.subhead,
    supportLine: copy.supportLine,
    address,
    qrLabel: copy.qrLabel,
    cta: copy.cta,
    footer,
    primaryColor: brief.primaryColor,
    template: brief.template,
    showStars,
    averageRating: brief.averageRating,
    reviewCount: brief.reviewCount,
    qrTop: layout.qrTop,
    qrLeft: layout.qrLeft,
    qrCardSize: layout.qrCardSize,
  };

  const textOverlay =
    layout.orientation === "landscape"
      ? buildLandscapeTextOverlaySvg(textOverlayInput)
      : buildPortraitTextOverlaySvg(textOverlayInput);

  layers.push({ input: textOverlay, top: 0, left: 0 });

  return sharp(background).composite(layers).png().toBuffer();
}
