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

async function buildQrPresentationCard(
  qrCard: Buffer,
  layout: FlyerLayout,
  primaryColor: string
): Promise<Buffer> {
  const border = 3;
  const shadowPad = 10;
  const borderedSize = layout.qrCardSize + border * 2;
  const frameSize = borderedSize + shadowPad * 2;
  const rgb = hexToRgb(primaryColor);

  const bordered = await sharp({
    create: {
      width: borderedSize,
      height: borderedSize,
      channels: 4,
      background: { ...rgb, alpha: 1 },
    },
  })
    .composite([{ input: qrCard, top: border, left: border }])
    .png()
    .toBuffer();

  const shadow = await sharp(
    Buffer.from(
      `<svg width="${frameSize}" height="${frameSize}" xmlns="http://www.w3.org/2000/svg"><rect x="${shadowPad + 2}" y="${shadowPad + 4}" width="${borderedSize}" height="${borderedSize}" rx="12" fill="#000000" fill-opacity="0.14"/></svg>`
    )
  )
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: frameSize,
      height: frameSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadow, top: 0, left: 0 },
      { input: bordered, top: shadowPad, left: shadowPad },
    ])
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

  const qrCard = await buildQrCard(qrBuffer, layout, tokens, brief.primaryColor);
  const qrPresentation = await buildQrPresentationCard(qrCard, layout, brief.primaryColor);
  const presentationMeta = await sharp(qrPresentation).metadata();
  const presentationSize = presentationMeta.width ?? layout.qrCardSize;
  const presentationInset = Math.round((presentationSize - layout.qrCardSize) / 2);
  const qrPresentationTop = layout.qrTop - presentationInset;
  const qrPresentationLeft = layout.qrLeft - presentationInset;

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
    top: qrPresentationTop,
    left: qrPresentationLeft,
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
