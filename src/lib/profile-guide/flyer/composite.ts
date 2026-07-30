import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";
import type { FlyerBrief } from "./brief";
import { buildFlyerEyebrow, buildFlyerSupportLine } from "./context";
import { resolveFlyerCopy } from "./copy";
import { computeFlyerLayout, getFlyerFormatSpec, type FlyerLayout } from "./formats";
import { buildFlyerFooter } from "./options";

export interface CompositeFlyerInput {
  brief: FlyerBrief;
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

function buildContentCardSvg(layout: FlyerLayout): Buffer {
  const { contentCardLeft, contentCardTop, contentCardWidth, contentCardHeight, contentCardRadius } =
    layout;

  const svg = [
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<filter id="cardShadow" x="-8%" y="-4%" width="116%" height="112%">`,
    `<feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.12"/>`,
    `</filter>`,
    `</defs>`,
    `<rect x="${contentCardLeft}" y="${contentCardTop}" width="${contentCardWidth}" height="${contentCardHeight}" rx="${contentCardRadius}" ry="${contentCardRadius}" fill="#ffffff" fill-opacity="0.97" filter="url(#cardShadow)"/>`,
    `</svg>`,
  ].join("");

  return Buffer.from(svg);
}

interface TextOverlayInput {
  layout: FlyerLayout;
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
  template: FlyerBrief["template"];
  showStars: boolean;
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
  const { layout } = input;
  const headlineSize =
    input.template === "bold" ? layout.headlineSize + 10 : layout.headlineSize;
  const centerX = Math.round(layout.width / 2);
  const textBottomLimit = input.qrTop - 16;

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
      letterSpacing: 1.2,
      uppercase: true,
    });
    y += 4;
  }

  y = appendCenteredText(
    parts,
    centerX,
    y,
    truncate(input.businessName, 48),
    layout.businessNameSize,
    { weight: 700, fill: "#202124" }
  );
  y += 6;

  for (const line of headlineLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${escapeXml(input.primaryColor)}">${escapeXml(line)}</text>`
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

  if (input.showStars && y < textBottomLimit - 28) {
    y += 6;
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(layout.subheadSize * 1.15)}" fill="#f9ab00">★★★★★</text>`
    );
    y += Math.round(layout.subheadSize * 1.15) + 4;
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
  const { layout } = input;
  const headlineSize =
    input.template === "bold" ? layout.headlineSize + 8 : layout.headlineSize;
  const textX = layout.contentCardLeft + layout.contentCardPadding;
  const textWidth = layout.contentCardWidth - layout.contentCardPadding * 2;
  const centerX = textX + Math.round(textWidth / 2);
  const qrLabelX = input.qrLeft + Math.round(input.qrCardSize / 2);

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
      letterSpacing: 1.2,
      uppercase: true,
    });
    y += 4;
  }

  y = appendCenteredText(
    parts,
    centerX,
    y,
    truncate(input.businessName, 40),
    layout.businessNameSize,
    { weight: 700, fill: "#202124" }
  );
  y += 6;

  for (const line of headlineLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${escapeXml(input.primaryColor)}">${escapeXml(line)}</text>`
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

  if (input.showStars) {
    y += 8;
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(layout.subheadSize * 1.1)}" fill="#f9ab00">★★★★★</text>`
    );
    y += Math.round(layout.subheadSize * 1.1) + 8;
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
  const showStars = brief.displayOptions.showStars;

  const [logoBuffer, coverBuffer] = await Promise.all([
    loadImageBuffer(brief.logoUrl),
    loadImageBuffer(brief.coverImageUrl),
  ]);

  const qrPadding = Math.round((layout.qrCardSize - layout.qrCodeSize) / 2);
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

  const qrCard = await sharp({
    create: {
      width: layout.qrCardSize,
      height: layout.qrCardSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: qrBuffer, top: qrPadding, left: qrPadding }])
    .png()
    .toBuffer();

  const background = await sharp(input.background)
    .resize(layout.width, layout.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const layers: OverlayOptions[] = [];

  if (coverBuffer && layout.orientation === "portrait") {
    const cover = await sharp(coverBuffer)
      .resize(layout.width, layout.coverHeight, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    layers.push({ input: cover, top: 0, left: 0 });

    const coverFade = await sharp({
      create: {
        width: layout.width,
        height: layout.coverHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.32 },
      },
    })
      .png()
      .toBuffer();
    layers.push({ input: coverFade, top: 0, left: 0 });
  }

  layers.push({ input: buildContentCardSvg(layout), top: 0, left: 0 });

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
        : coverBuffer
          ? layout.logoTop
          : layout.contentCardTop + layout.contentCardPadding;

    layers.push({
      input: logo,
      top: logoTop,
      left: logoLeft,
    });
  }

  layers.push({ input: qrCard, top: layout.qrTop, left: layout.qrLeft });

  const textOverlay =
    layout.orientation === "landscape"
      ? buildLandscapeTextOverlaySvg({
          layout,
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
          qrTop: layout.qrTop,
          qrLeft: layout.qrLeft,
          qrCardSize: layout.qrCardSize,
        })
      : buildPortraitTextOverlaySvg({
          layout,
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
          qrTop: layout.qrTop,
          qrLeft: layout.qrLeft,
          qrCardSize: layout.qrCardSize,
        });

  layers.push({ input: textOverlay, top: 0, left: 0 });

  return sharp(background).composite(layers).png().toBuffer();
}
