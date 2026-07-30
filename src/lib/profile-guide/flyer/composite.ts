import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";
import type { FlyerDesignBrief } from "./design-brief";
import { buildFlyerEyebrow, buildFlyerSupportLine } from "./context";
import { resolveFlyerCopy } from "./copy";
import { computeFlyerLayout, getFlyerFormatSpec, type FlyerLayout } from "./formats";
import {
  getArchetypeLayoutTokens,
  type ArchetypeLayoutTokens,
  type CoverTreatment,
} from "./layout-variants";
import { buildFlyerFooter } from "./options";
import { renderFlyerTextOverlay } from "./text-overlay";

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

function effectiveCoverHeight(layout: FlyerLayout, tokens: ArchetypeLayoutTokens): number {
  if (tokens.coverTreatment === "none") return 0;
  const base = Math.round(layout.coverHeight * tokens.coverHeightRatio);
  return layout.orientation === "landscape" ? Math.round(base * 0.72) : base;
}

function buildCoverFadeSvg(
  width: number,
  height: number,
  treatment: CoverTreatment,
  fadeOpacity: number
): Buffer {
  const bottomOpacity = Math.min(fadeOpacity + 0.12, 0.72);
  const midOpacity = Math.min(fadeOpacity, 0.42);
  const vignetteOpacity =
    treatment === "full-bleed-fade" ? Math.min(fadeOpacity + 0.06, 0.38) : 0;

  const parts = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<linearGradient id="coverFade" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#000000" stop-opacity="0"/>`,
    `<stop offset="55%" stop-color="#000000" stop-opacity="${midOpacity * 0.35}"/>`,
    `<stop offset="100%" stop-color="#000000" stop-opacity="${bottomOpacity}"/>`,
    `</linearGradient>`,
  ];

  if (vignetteOpacity > 0) {
    parts.push(
      `<radialGradient id="coverVignette" cx="50%" cy="35%" r="75%">`,
      `<stop offset="35%" stop-color="#000000" stop-opacity="0"/>`,
      `<stop offset="100%" stop-color="#000000" stop-opacity="${vignetteOpacity}"/>`,
      `</radialGradient>`
    );
  }

  parts.push(`</defs>`, `<rect width="100%" height="100%" fill="url(#coverFade)"/>`);

  if (vignetteOpacity > 0) {
    parts.push(`<rect width="100%" height="100%" fill="url(#coverVignette)"/>`);
  }

  parts.push(`</svg>`);
  return Buffer.from(parts.join(""));
}

function buildContentScrimSvg(layout: FlyerLayout): Buffer {
  const scrimTop = layout.contentCardTop;
  const scrimHeight = layout.height - scrimTop;

  const parts = [
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<linearGradient id="contentScrim" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#000000" stop-opacity="0"/>`,
    `<stop offset="35%" stop-color="#000000" stop-opacity="0.04"/>`,
    `<stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect x="0" y="${scrimTop}" width="${layout.width}" height="${scrimHeight}" fill="url(#contentScrim)"/>`,
    `</svg>`,
  ];

  return Buffer.from(parts.join(""));
}


async function buildQrPresentation(
  qrBuffer: Buffer,
  layout: FlyerLayout,
  tokens: ArchetypeLayoutTokens,
  primaryColor: string
): Promise<Buffer> {
  const cardSize = layout.qrCardSize;
  const qrSize = layout.qrCodeSize;
  const padding = Math.round((cardSize - qrSize) / 2);
  const borderWidth = tokens.qrFrame === "branded-ring" ? 5 : 3;
  const radius = tokens.qrFrame === "white-square" ? 6 : 14;
  const strokeColor = escapeXml(primaryColor);

  const qr = await sharp(qrBuffer).resize(qrSize, qrSize, { fit: "fill" }).png().toBuffer();

  const frameSvg = Buffer.from(
    [
      `<svg width="${cardSize}" height="${cardSize}" xmlns="http://www.w3.org/2000/svg">`,
      `<rect x="${borderWidth / 2}" y="${borderWidth / 2}" width="${cardSize - borderWidth}" height="${cardSize - borderWidth}" rx="${radius}" ry="${radius}" fill="#ffffff" stroke="${strokeColor}" stroke-width="${borderWidth}"/>`,
      `</svg>`,
    ].join("")
  );

  return sharp(frameSvg)
    .composite([{ input: qr, top: padding, left: padding }])
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

  const coverSource = brief.resolvedCoverUrl ?? brief.coverImageUrl;

  const [logoBuffer, coverBuffer] = await Promise.all([
    loadImageBuffer(brief.logoUrl),
    loadImageBuffer(coverSource),
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

  const qrPresentation = await buildQrPresentation(
    qrBuffer,
    layout,
    tokens,
    brief.primaryColor
  );

  const background = await sharp(input.background)
    .resize(layout.width, layout.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const layers: OverlayOptions[] = [];

  if (coverBuffer && coverHeight > 0) {
    const cover = await sharp(coverBuffer)
      .resize(layout.width, coverHeight, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    layers.push({ input: cover, top: 0, left: 0 });

    const coverFade = await sharp(
      buildCoverFadeSvg(layout.width, coverHeight, tokens.coverTreatment, tokens.coverFadeOpacity)
    )
      .png()
      .toBuffer();
    layers.push({ input: coverFade, top: 0, left: 0 });
  }

  layers.push({
    input: buildContentScrimSvg(layout),
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
          ? Math.max(12, coverHeight - Math.round(layout.logoMaxHeight * 0.62))
          : layout.contentCardTop + layout.contentCardPadding;

    layers.push({
      input: logo,
      top: logoTop,
      left: logoLeft,
    });
  }

  layers.push({
    input: qrPresentation,
    top: layout.qrTop,
    left: layout.qrLeft,
  });

  layers.push({
    input: renderFlyerTextOverlay({
      layout,
      tokens,
      brief,
      copy,
      footer,
      eyebrow,
      address,
      showStars,
    }),
    top: 0,
    left: 0,
  });

  return sharp(background).composite(layers).png().toBuffer();
}
