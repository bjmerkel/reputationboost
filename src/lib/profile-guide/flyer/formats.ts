export const PROFILE_GUIDE_FLYER_FORMATS = ["letter", "a4", "postcard", "story"] as const;

export type ProfileGuideFlyerFormat = (typeof PROFILE_GUIDE_FLYER_FORMATS)[number];

export interface FlyerFormatSpec {
  id: ProfileGuideFlyerFormat;
  label: string;
  description: string;
  width: number;
  height: number;
  imageSize: string;
  orientation: "portrait" | "landscape";
}

export const FLYER_FORMAT_SPECS: Record<ProfileGuideFlyerFormat, FlyerFormatSpec> = {
  letter: {
    id: "letter",
    label: "Letter",
    description: "8.5×11 counter stand",
    width: 1024,
    height: 1536,
    imageSize: "1024x1536",
    orientation: "portrait",
  },
  a4: {
    id: "a4",
    label: "A4",
    description: "International print",
    width: 1024,
    height: 1440,
    imageSize: "1024x1440",
    orientation: "portrait",
  },
  postcard: {
    id: "postcard",
    label: "4×6 postcard",
    description: "Receipts and handouts",
    width: 1536,
    height: 1024,
    imageSize: "1536x1024",
    orientation: "landscape",
  },
  story: {
    id: "story",
    label: "Story",
    description: "Instagram and SMS sharing",
    width: 1080,
    height: 1920,
    imageSize: "1080x1920",
    orientation: "portrait",
  },
};

export function parseProfileGuideFlyerFormat(
  value: string | undefined | null
): ProfileGuideFlyerFormat {
  if (value && PROFILE_GUIDE_FLYER_FORMATS.includes(value as ProfileGuideFlyerFormat)) {
    return value as ProfileGuideFlyerFormat;
  }
  return "letter";
}

export function getFlyerFormatSpec(format: ProfileGuideFlyerFormat): FlyerFormatSpec {
  return FLYER_FORMAT_SPECS[format];
}

export interface FlyerLayout {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  coverHeight: number;
  logoTop: number;
  logoMaxWidth: number;
  logoMaxHeight: number;
  qrCardSize: number;
  qrCodeSize: number;
  qrTop: number;
  qrLeft: number;
  textTop: number;
  headlineSize: number;
  businessNameSize: number;
  subheadSize: number;
  ctaSize: number;
  footerSize: number;
  starsY: number;
  ctaY: number;
  footerY: number;
  headlineMaxChars: number;
  subheadMaxChars: number;
}

export function computeFlyerLayout(spec: FlyerFormatSpec): FlyerLayout {
  if (spec.orientation === "landscape") {
    return {
      width: spec.width,
      height: spec.height,
      orientation: "landscape",
      coverHeight: Math.round(spec.height * 0.42),
      logoTop: Math.round(spec.height * 0.1),
      logoMaxWidth: Math.round(spec.width * 0.18),
      logoMaxHeight: Math.round(spec.height * 0.14),
      qrCardSize: Math.round(Math.min(spec.height * 0.62, spec.width * 0.28)),
      qrCodeSize: Math.round(Math.min(spec.height * 0.52, spec.width * 0.24)),
      qrTop: Math.round(spec.height * 0.2),
      qrLeft: Math.round(spec.width * 0.66),
      textTop: Math.round(spec.height * 0.16),
      headlineSize: 52,
      businessNameSize: 24,
      subheadSize: 22,
      ctaSize: 18,
      footerSize: 16,
      starsY: Math.round(spec.height * 0.78),
      ctaY: Math.round(spec.height * 0.86),
      footerY: Math.round(spec.height * 0.93),
      headlineMaxChars: 18,
      subheadMaxChars: 24,
    };
  }

  const scaleY = spec.height / 1536;
  const scaleX = spec.width / 1024;
  const scale = Math.min(scaleX, scaleY);
  const qrTop = Math.round(860 * scaleY);

  return {
    width: spec.width,
    height: spec.height,
    orientation: "portrait",
    coverHeight: Math.round(300 * scaleY),
    logoTop: Math.round(48 * scaleY),
    logoMaxWidth: Math.round(180 * scale),
    logoMaxHeight: Math.round(90 * scale),
    qrCardSize: Math.round(320 * scale),
    qrCodeSize: Math.round(280 * scale),
    qrTop,
    qrLeft: Math.round((spec.width - 320 * scale) / 2),
    textTop: Math.round(160 * scaleY),
    headlineSize: Math.round(46 * scale),
    businessNameSize: Math.round(28 * scale),
    subheadSize: Math.round(24 * scale),
    ctaSize: Math.round(20 * scale),
    footerSize: Math.round(18 * scale),
    starsY: qrTop + Math.round(360 * scaleY),
    ctaY: qrTop + Math.round(404 * scaleY),
    footerY: qrTop + Math.round(438 * scaleY),
    headlineMaxChars: 22,
    subheadMaxChars: 28,
  };
}
