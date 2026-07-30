import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";
import type { FlyerBrief } from "./brief";
import { resolveFlyerCopy } from "./copy";
import { FLYER_CANVAS_HEIGHT, FLYER_CANVAS_WIDTH } from "./generate-image";

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

function buildTextOverlaySvg(input: {
  businessName: string;
  headline: string;
  subhead: string;
  cta: string;
  footer: string;
  primaryColor: string;
  template: FlyerBrief["template"];
  hasLogo: boolean;
  hasCover: boolean;
}): Buffer {
  const topOffset = input.hasCover ? 360 : input.hasLogo ? 220 : 160;
  const headlineSize = input.template === "bold" ? 58 : 46;
  const businessSize = 28;
  const subheadSize = 24;
  const ctaSize = 20;
  const footerSize = 18;

  const headlineLines = wrapSvgLines(input.headline, 22, 2);
  const subheadLines = wrapSvgLines(input.subhead, 28, 2);

  let y = topOffset;
  const parts: string[] = [
    `<svg width="${FLYER_CANVAS_WIDTH}" height="${FLYER_CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="100%" height="100%" fill="none"/>`,
    `<text x="512" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${businessSize}" font-weight="700" fill="#202124">${escapeXml(truncate(input.businessName, 48))}</text>`,
  ];

  y += 56;
  for (const line of headlineLines) {
    parts.push(
      `<text x="512" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${escapeXml(input.primaryColor)}">${escapeXml(line)}</text>`
    );
    y += headlineSize + 8;
  }

  y += 8;
  for (const line of subheadLines) {
    parts.push(
      `<text x="512" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${subheadSize}" fill="#5f6368">${escapeXml(line)}</text>`
    );
    y += subheadSize + 6;
  }

  const qrTop = 860;
  parts.push(
    `<text x="512" y="${qrTop + 360}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#f9ab00">★★★★★</text>`,
    `<text x="512" y="${qrTop + 404}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${ctaSize}" fill="#3c4043">${escapeXml(truncate(input.cta, 64))}</text>`,
    `<text x="512" y="${qrTop + 438}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${footerSize}" fill="#80868b">${escapeXml(truncate(input.footer, 56))}</text>`,
    "</svg>"
  );

  return Buffer.from(parts.join(""));
}

export async function compositeFlyerImage(input: CompositeFlyerInput): Promise<Buffer> {
  const { brief } = input;
  const copy = resolveFlyerCopy(brief.template, brief.tagline);
  const footer = brief.phone?.trim() || brief.website?.trim() || brief.publicUrl;

  const [logoBuffer, coverBuffer] = await Promise.all([
    loadImageBuffer(brief.logoUrl),
    loadImageBuffer(brief.coverImageUrl),
  ]);

  const qrBuffer = await QRCode.toBuffer(`${brief.publicUrl}?src=flyer-${brief.template}`, {
    type: "png",
    width: 280,
    margin: 1,
    color: {
      dark: brief.primaryColor,
      light: "#ffffff",
    },
  });

  const qrCard = await sharp({
    create: {
      width: 320,
      height: 320,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.96 },
    },
  })
    .composite([{ input: qrBuffer, top: 20, left: 20 }])
    .png()
    .toBuffer();

  const layers: OverlayOptions[] = [];

  if (coverBuffer) {
    const cover = await sharp(coverBuffer)
      .resize(FLYER_CANVAS_WIDTH, 300, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    layers.push({ input: cover, top: 0, left: 0 });

    const coverFade = await sharp({
      create: {
        width: FLYER_CANVAS_WIDTH,
        height: 300,
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
      .resize({ width: 180, height: 90, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const metadata = await sharp(logo).metadata();
    const logoWidth = metadata.width ?? 180;
    const logoHeight = metadata.height ?? 90;
    layers.push({
      input: logo,
      top: coverBuffer ? 320 : 48,
      left: Math.round((FLYER_CANVAS_WIDTH - logoWidth) / 2),
    });
    void logoHeight;
  }

  layers.push({ input: qrCard, top: 860, left: 352 });

  const textOverlay = buildTextOverlaySvg({
    businessName: brief.businessName,
    headline: copy.headline,
    subhead: copy.subhead,
    cta: copy.cta,
    footer,
    primaryColor: brief.primaryColor,
    template: brief.template,
    hasLogo: Boolean(logoBuffer),
    hasCover: Boolean(coverBuffer),
  });

  layers.push({ input: textOverlay, top: 0, left: 0 });

  const background = await sharp(input.background)
    .resize(FLYER_CANVAS_WIDTH, FLYER_CANVAS_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  return sharp(background).composite(layers).png().toBuffer();
}
