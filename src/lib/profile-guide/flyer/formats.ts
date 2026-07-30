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
  contentCardTop: number;
  contentCardLeft: number;
  contentCardWidth: number;
  contentCardHeight: number;
  contentCardPadding: number;
  contentCardRadius: number;
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
  eyebrowSize: number;
  qrLabelSize: number;
  supportLineSize: number;
  addressSize: number;
  headlineMaxChars: number;
  subheadMaxChars: number;
}

export function computeFlyerLayout(spec: FlyerFormatSpec): FlyerLayout {
  if (spec.orientation === "landscape") {
    const margin = Math.round(spec.height * 0.06);
    const cardLeft = Math.round(spec.width * 0.05);
    const cardTop = margin;
    const cardWidth = Math.round(spec.width * 0.52);
    const cardHeight = spec.height - margin * 2;
    const qrCardSize = Math.round(Math.min(spec.height * 0.58, spec.width * 0.26));
    const qrCodeSize = Math.round(qrCardSize * 0.82);
    const qrLeft = Math.round(spec.width * 0.66);
    const qrTop = Math.round((spec.height - qrCardSize) / 2);

    return {
      width: spec.width,
      height: spec.height,
      orientation: "landscape",
      coverHeight: Math.round(spec.height * 0.34),
      logoTop: cardTop + Math.round(spec.height * 0.04),
      logoMaxWidth: Math.round(spec.width * 0.14),
      logoMaxHeight: Math.round(spec.height * 0.12),
      contentCardTop: cardTop,
      contentCardLeft: cardLeft,
      contentCardWidth: cardWidth,
      contentCardHeight: cardHeight,
      contentCardPadding: Math.round(spec.height * 0.05),
      contentCardRadius: Math.round(spec.height * 0.025),
      qrCardSize,
      qrCodeSize,
      qrTop,
      qrLeft,
      textTop: cardTop + Math.round(spec.height * 0.14),
      headlineSize: 44,
      businessNameSize: 22,
      subheadSize: 20,
      ctaSize: 17,
      footerSize: 15,
      eyebrowSize: 14,
      qrLabelSize: 16,
      supportLineSize: 17,
      addressSize: 15,
      headlineMaxChars: 20,
      subheadMaxChars: 28,
    };
  }

  const scaleY = spec.height / 1536;
  const scaleX = spec.width / 1024;
  const scale = Math.min(scaleX, scaleY);
  const margin = Math.round(36 * scale);
  const coverHeight = Math.round(spec.height * 0.16);
  const contentCardTop = coverHeight - Math.round(10 * scaleY);
  const contentCardLeft = margin;
  const contentCardWidth = spec.width - margin * 2;
  const contentCardHeight = spec.height - contentCardTop - margin;
  const contentCardPadding = Math.round(32 * scale);
  const qrCardSize = Math.round(248 * scale);
  const qrCodeSize = Math.round(210 * scale);
  const qrTop = contentCardTop + Math.round(contentCardHeight * 0.46);
  const qrLeft = Math.round((spec.width - qrCardSize) / 2);

  return {
    width: spec.width,
    height: spec.height,
    orientation: "portrait",
    coverHeight,
    logoTop: coverHeight - Math.round(36 * scaleY),
    logoMaxWidth: Math.round(150 * scale),
    logoMaxHeight: Math.round(76 * scale),
    contentCardTop,
    contentCardLeft,
    contentCardWidth,
    contentCardHeight,
    contentCardPadding,
    contentCardRadius: Math.round(18 * scale),
    qrCardSize,
    qrCodeSize,
    qrTop,
    qrLeft,
    textTop: contentCardTop + contentCardPadding + Math.round(52 * scaleY),
    headlineSize: Math.round(42 * scale),
    businessNameSize: Math.round(26 * scale),
    subheadSize: Math.round(22 * scale),
    ctaSize: Math.round(18 * scale),
    footerSize: Math.round(16 * scale),
    eyebrowSize: Math.round(14 * scale),
    qrLabelSize: Math.round(16 * scale),
    supportLineSize: Math.round(17 * scale),
    addressSize: Math.round(15 * scale),
    headlineMaxChars: 22,
    subheadMaxChars: 30,
  };
}
