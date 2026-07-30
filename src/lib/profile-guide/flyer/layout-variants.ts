import type { FlyerDesignArchetype } from "./archetypes";

export type CoverTreatment = "hero-band" | "full-bleed-fade" | "minimal-hero" | "none";
export type CardStyle = "white-card" | "glass-panel" | "framed-card";
export type QrFrameStyle = "white-square" | "rounded-card" | "branded-ring";
export type AccentBarStyle = "top" | "diagonal" | "none";
export type StarStyle = "inline" | "badge";

export interface ArchetypeLayoutTokens {
  coverTreatment: CoverTreatment;
  coverHeightRatio: number;
  coverFadeOpacity: number;
  cardStyle: CardStyle;
  cardRadiusScale: number;
  cardFillOpacity: number;
  cardBorderColor: string | null;
  accentBarStyle: AccentBarStyle;
  starStyle: StarStyle;
  qrFrame: QrFrameStyle;
  headlineWeight: number;
  businessNameWeight: number;
  eyebrowUppercase: boolean;
  showRatingInStars: boolean;
}

const DEFAULT_TOKENS: ArchetypeLayoutTokens = {
  coverTreatment: "hero-band",
  coverHeightRatio: 1,
  coverFadeOpacity: 0.32,
  cardStyle: "white-card",
  cardRadiusScale: 1,
  cardFillOpacity: 0.97,
  cardBorderColor: null,
  accentBarStyle: "none",
  starStyle: "inline",
  qrFrame: "rounded-card",
  headlineWeight: 800,
  businessNameWeight: 700,
  eyebrowUppercase: true,
  showRatingInStars: false,
};

const ARCHETYPE_LAYOUT_TOKENS: Record<FlyerDesignArchetype, ArchetypeLayoutTokens> = {
  "friendly-educational": {
    ...DEFAULT_TOKENS,
    coverHeightRatio: 1.1,
    coverFadeOpacity: 0.28,
    cardRadiusScale: 1.35,
    cardFillOpacity: 0.98,
    qrFrame: "rounded-card",
    headlineWeight: 800,
    showRatingInStars: true,
  },
  "industrial-modern": {
    ...DEFAULT_TOKENS,
    coverFadeOpacity: 0.42,
    cardRadiusScale: 0.55,
    accentBarStyle: "diagonal",
    qrFrame: "branded-ring",
    headlineWeight: 900,
    businessNameWeight: 800,
  },
  "clinical-luxury": {
    ...DEFAULT_TOKENS,
    coverTreatment: "minimal-hero",
    coverHeightRatio: 0.75,
    coverFadeOpacity: 0.22,
    cardStyle: "glass-panel",
    cardRadiusScale: 0.85,
    cardFillOpacity: 0.94,
    qrFrame: "white-square",
    headlineWeight: 700,
    eyebrowUppercase: false,
  },
  "editorial-food": {
    ...DEFAULT_TOKENS,
    coverTreatment: "full-bleed-fade",
    coverHeightRatio: 1.35,
    coverFadeOpacity: 0.38,
    cardRadiusScale: 1.1,
    accentBarStyle: "top",
    qrFrame: "rounded-card",
    showRatingInStars: true,
  },
  "luxury-boutique": {
    ...DEFAULT_TOKENS,
    coverFadeOpacity: 0.35,
    cardStyle: "framed-card",
    cardRadiusScale: 0.7,
    cardBorderColor: "#c4a35a",
    accentBarStyle: "top",
    qrFrame: "branded-ring",
    headlineWeight: 700,
    businessNameWeight: 700,
    eyebrowUppercase: false,
    starStyle: "badge",
  },
  "organic-minimal": {
    ...DEFAULT_TOKENS,
    coverTreatment: "minimal-hero",
    coverHeightRatio: 0.8,
    coverFadeOpacity: 0.2,
    cardStyle: "glass-panel",
    cardRadiusScale: 1.25,
    cardFillOpacity: 0.93,
    qrFrame: "rounded-card",
    headlineWeight: 700,
    eyebrowUppercase: false,
  },
  "athletic-energy": {
    ...DEFAULT_TOKENS,
    coverFadeOpacity: 0.45,
    cardRadiusScale: 0.65,
    accentBarStyle: "diagonal",
    qrFrame: "branded-ring",
    headlineWeight: 900,
    businessNameWeight: 800,
    starStyle: "badge",
  },
  "executive": {
    ...DEFAULT_TOKENS,
    coverTreatment: "minimal-hero",
    coverHeightRatio: 0.7,
    cardRadiusScale: 0.6,
    cardFillOpacity: 0.98,
    accentBarStyle: "top",
    qrFrame: "white-square",
    headlineWeight: 700,
    businessNameWeight: 700,
    eyebrowUppercase: false,
  },
  "cozy-lifestyle": {
    ...DEFAULT_TOKENS,
    coverHeightRatio: 1.15,
    coverFadeOpacity: 0.3,
    cardRadiusScale: 1.2,
    qrFrame: "rounded-card",
    showRatingInStars: true,
  },
  "modern-luxury": {
    ...DEFAULT_TOKENS,
    coverTreatment: "full-bleed-fade",
    coverHeightRatio: 1.2,
    coverFadeOpacity: 0.36,
    cardStyle: "glass-panel",
    cardRadiusScale: 0.75,
    cardFillOpacity: 0.95,
    qrFrame: "branded-ring",
    headlineWeight: 800,
    eyebrowUppercase: false,
    starStyle: "badge",
  },
  "technical-professional": {
    ...DEFAULT_TOKENS,
    cardRadiusScale: 0.7,
    accentBarStyle: "top",
    qrFrame: "white-square",
    headlineWeight: 800,
    businessNameWeight: 700,
  },
  "local-trust": {
    ...DEFAULT_TOKENS,
  },
};

export function getArchetypeLayoutTokens(
  archetype?: FlyerDesignArchetype | null
): ArchetypeLayoutTokens {
  if (!archetype) return DEFAULT_TOKENS;
  return ARCHETYPE_LAYOUT_TOKENS[archetype] ?? DEFAULT_TOKENS;
}
