import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";
import type { FlyerBrief } from "./brief";
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

function buildPortraitTextOverlaySvg(input: {
  layout: FlyerLayout;
  businessName: string;
  headline: string;
  subhead: string;
  cta: string;
  footer: string;
  primaryColor: string;
  template: FlyerBrief["template"];
  hasLogo: boolean;
  hasCover: boolean;
  showStars: boolean;
}): Buffer {
  const { layout } = input;
  const headlineSize = input.template === "bold" ? layout.headlineSize + 12 : layout.headlineSize;
  const topOffset = input.hasCover
    ? layout.coverHeight + (input.hasLogo ? 120 : 72)
    : input.hasLogo
      ? layout.logoTop + layout.logoMaxHeight + 48
      : layout.textTop;

  const headlineLines = wrapSvgLines(input.headline, layout.headlineMaxChars, 2);
  const subheadLines = wrapSvgLines(input.subhead, layout.subheadMaxChars, 2);
  const centerX = Math.round(layout.width / 2);

  let y = topOffset;
  const parts: string[] = [
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="100%" height="100%" fill="none"/>`,
    `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.businessNameSize}" font-weight="700" fill="#202124">${escapeXml(truncate(input.businessName, 48))}</text>`,
  ];

  y += layout.businessNameSize + 28;
  for (const line of headlineLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${escapeXml(input.primaryColor)}">${escapeXml(line)}</text>`
    );
    y += headlineSize + 8;
  }

  y += 8;
  for (const line of subheadLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.subheadSize}" fill="#5f6368">${escapeXml(line)}</text>`
    );
    y += layout.subheadSize + 6;
  }

  parts.push(
    ...(input.showStars
      ? [
          `<text x="${centerX}" y="${layout.starsY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(layout.subheadSize * 1.2)}" fill="#f9ab00">★★★★★</text>`,
        ]
      : []),
    `<text x="${centerX}" y="${layout.ctaY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.ctaSize}" fill="#3c4043">${escapeXml(truncate(input.cta, 64))}</text>`,
    `<text x="${centerX}" y="${layout.footerY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.footerSize}" fill="#80868b">${escapeXml(truncate(input.footer, 56))}</text>`,
    "</svg>"
  );

  return Buffer.from(parts.join(""));
}

function buildLandscapeTextOverlaySvg(input: {
  layout: FlyerLayout;
  businessName: string;
  headline: string;
  subhead: string;
  cta: string;
  footer: string;
  primaryColor: string;
  template: FlyerBrief["template"];
  showStars: boolean;
}): Buffer {
  const { layout } = input;
  const headlineSize = input.template === "bold" ? layout.headlineSize + 8 : layout.headlineSize;
  const textX = Math.round(layout.width * 0.08);
  const textWidth = Math.round(layout.width * 0.52);
  const centerX = textX + Math.round(textWidth / 2);

  const headlineLines = wrapSvgLines(input.headline, layout.headlineMaxChars, 2);
  const subheadLines = wrapSvgLines(input.subhead, layout.subheadMaxChars, 2);

  let y = layout.textTop;
  const parts: string[] = [
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="100%" height="100%" fill="none"/>`,
    `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.businessNameSize}" font-weight="700" fill="#202124">${escapeXml(truncate(input.businessName, 40))}</text>`,
  ];

  y += layout.businessNameSize + 24;
  for (const line of headlineLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${escapeXml(input.primaryColor)}">${escapeXml(line)}</text>`
    );
    y += headlineSize + 8;
  }

  y += 8;
  for (const line of subheadLines) {
    parts.push(
      `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.subheadSize}" fill="#5f6368">${escapeXml(line)}</text>`
    );
    y += layout.subheadSize + 6;
  }

  parts.push(
    ...(input.showStars
      ? [
          `<text x="${centerX}" y="${layout.starsY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(layout.subheadSize * 1.1)}" fill="#f9ab00">★★★★★</text>`,
        ]
      : []),
    `<text x="${centerX}" y="${layout.ctaY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.ctaSize}" fill="#3c4043">${escapeXml(truncate(input.cta, 56))}</text>`,
    `<text x="${centerX}" y="${layout.footerY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.footerSize}" fill="#80868b">${escapeXml(truncate(input.footer, 48))}</text>`,
    "</svg>"
  );

  return Buffer.from(parts.join(""));
}

export async function compositeFlyerImage(input: CompositeFlyerInput): Promise<Buffer> {
  const { brief } = input;
  const tagline = brief.displayOptions.showTagline ? brief.tagline : null;
  const copy = brief.copy ?? resolveFlyerCopy(brief.template, tagline);
  const footer = buildFlyerFooter(brief, brief.displayOptions);
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
      background: { r: 255, g: 255, b: 255, alpha: 0.96 },
    },
  })
    .composite([{ input: qrBuffer, top: qrPadding, left: qrPadding }])
    .png()
    .toBuffer();

  const layers: OverlayOptions[] = [];

  if (coverBuffer) {
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
        background: { r: 0, g: 0, b: 0, alpha: 0.28 },
      },
    })
      .png()
      .toBuffer();
    layers.push({ input: coverFade, top: 0, left: 0 });
  }

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
        ? Math.round(layout.width * 0.08)
        : Math.round((layout.width - logoWidth) / 2);
    const logoTop =
      layout.orientation === "landscape"
        ? layout.logoTop
        : coverBuffer
          ? layout.coverHeight + 16
          : layout.logoTop;

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
          headline: copy.headline,
          subhead: copy.subhead,
          cta: copy.cta,
          footer,
          primaryColor: brief.primaryColor,
          template: brief.template,
          showStars,
        })
      : buildPortraitTextOverlaySvg({
          layout,
          businessName: brief.businessName,
          headline: copy.headline,
          subhead: copy.subhead,
          cta: copy.cta,
          footer,
          primaryColor: brief.primaryColor,
          template: brief.template,
          hasLogo: Boolean(logoBuffer),
          hasCover: Boolean(coverBuffer),
          showStars,
        });

  layers.push({ input: textOverlay, top: 0, left: 0 });

  const background = await sharp(input.background)
    .resize(layout.width, layout.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  return sharp(background).composite(layers).png().toBuffer();
}
