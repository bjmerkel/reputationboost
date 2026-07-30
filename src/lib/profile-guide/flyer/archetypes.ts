export const FLYER_DESIGN_ARCHETYPES = [
  "friendly-educational",
  "industrial-modern",
  "clinical-luxury",
  "editorial-food",
  "luxury-boutique",
  "organic-minimal",
  "athletic-energy",
  "executive",
  "cozy-lifestyle",
  "modern-luxury",
  "technical-professional",
  "local-trust",
] as const;

export type FlyerDesignArchetype = (typeof FLYER_DESIGN_ARCHETYPES)[number];

export interface ArchetypeDefinition {
  id: FlyerDesignArchetype;
  label: string;
  mood: string;
  palette: string;
  typography: string;
  backgroundTreatment: string;
  texture: string;
  copyTone: string;
  headlineExamples: string[];
}

const ARCHETYPE_DEFINITIONS: Record<FlyerDesignArchetype, ArchetypeDefinition> = {
  "friendly-educational": {
    id: "friendly-educational",
    label: "Friendly Educational",
    mood: "warm, welcoming, family-friendly, trustworthy, upbeat",
    palette: "bright but refined brand colors with soft complementary accents",
    typography: "friendly rounded sans-serif energy",
    backgroundTreatment: "soft rounded abstract shapes, gentle gradients, playful but professional",
    texture: "light paper or watercolor wash, never cartoon clipart",
    copyTone: "warm and family-focused",
    headlineExamples: ["Love your child's experience?", "Happy with our care?"],
  },
  "industrial-modern": {
    id: "industrial-modern",
    label: "Industrial Modern",
    mood: "bold, capable, reliable, high-trust trades professionalism",
    palette: "navy, charcoal, gold, or strong brand contrast",
    typography: "bold geometric sans-serif energy",
    backgroundTreatment: "diagonal accents, strong structure, technical confidence",
    texture: "subtle metal, blueprint grid, or brushed industrial texture",
    copyTone: "direct and confident",
    headlineExamples: ["Great service today?", "Did we earn your trust?"],
  },
  "clinical-luxury": {
    id: "clinical-luxury",
    label: "Clinical Luxury",
    mood: "clean, calming, premium healthcare professionalism",
    palette: "white space feeling with soft blues, teals, or muted clinical accents",
    typography: "clean minimal sans-serif",
    backgroundTreatment: "lots of breathable space, precise calm composition",
    texture: "subtle linen or soft clinical gradient",
    copyTone: "reassuring and professional",
    headlineExamples: ["Care to share your experience?", "Were we helpful today?"],
  },
  "editorial-food": {
    id: "editorial-food",
    label: "Editorial Food",
    mood: "warm, appetizing, hospitality-driven, inviting",
    palette: "warm earth tones, rich accents, brand color highlights",
    typography: "editorial mix of modern sans with occasional script accent energy",
    backgroundTreatment: "lifestyle hospitality atmosphere with warm vignette zones",
    texture: "rustic paper, woodgrain wash, or soft culinary ambiance",
    copyTone: "hospitality and delight",
    headlineExamples: ["Enjoy your visit?", "Love the experience?"],
  },
  "luxury-boutique": {
    id: "luxury-boutique",
    label: "Luxury Boutique",
    mood: "elegant, refined, high-end boutique confidence",
    palette: "black, gold, cream, or restrained luxury neutrals",
    typography: "elegant serif and refined sans pairing energy",
    backgroundTreatment: "minimal luxury composition with fine detail",
    texture: "marble, silk, or subtle foil-like gradient",
    copyTone: "sophisticated and appreciative",
    headlineExamples: ["Enjoyed your visit?", "Appreciate our service?"],
  },
  "organic-minimal": {
    id: "organic-minimal",
    label: "Organic Minimal",
    mood: "calm, natural, wellness-oriented, serene",
    palette: "sage, cream, sand, soft greens, or muted earth brand tones",
    typography: "light airy sans-serif",
    backgroundTreatment: "organic flow, soft curves, natural balance",
    texture: "natural light gradient, botanical wash without literal plants",
    copyTone: "calm and inviting",
    headlineExamples: ["Feel refreshed today?", "Enjoy your experience?"],
  },
  "athletic-energy": {
    id: "athletic-energy",
    label: "Athletic Energy",
    mood: "dynamic, motivating, high-energy performance",
    palette: "high contrast brand colors with energetic accents",
    typography: "condensed bold athletic sans energy",
    backgroundTreatment: "dynamic angles, motion-inspired composition",
    texture: "subtle grain, mesh, or energetic gradient streaks",
    copyTone: "motivating and upbeat",
    headlineExamples: ["Crushed your workout?", "Love training here?"],
  },
  executive: {
    id: "executive",
    label: "Executive",
    mood: "authoritative, polished, conservative trust",
    palette: "charcoal, navy, deep neutrals with restrained accent",
    typography: "professional serif or executive sans energy",
    backgroundTreatment: "structured, balanced, understated authority",
    texture: "fine paper, subtle prestige gradient",
    copyTone: "professional and respectful",
    headlineExamples: ["Value our service?", "Appreciate our counsel?"],
  },
  "cozy-lifestyle": {
    id: "cozy-lifestyle",
    label: "Cozy Lifestyle",
    mood: "comfortable, neighborhood, handcrafted warmth",
    palette: "warm browns, creams, soft brand tones",
    typography: "approachable lifestyle sans energy",
    backgroundTreatment: "inviting lifestyle atmosphere with soft depth",
    texture: "coffeehouse paper, cozy ambient gradient",
    copyTone: "neighborly and warm",
    headlineExamples: ["Enjoy stopping by?", "Love the vibe here?"],
  },
  "modern-luxury": {
    id: "modern-luxury",
    label: "Modern Luxury",
    mood: "sleek, aspirational, contemporary premium",
    palette: "neutral luxury base with sharp brand accent",
    typography: "modern premium sans-serif",
    backgroundTreatment: "architectural spacing, clean luxury depth",
    texture: "soft concrete, glassy gradient, or premium minimal texture",
    copyTone: "aspirational and polished",
    headlineExamples: ["Impressed with your experience?", "Love what we do?"],
  },
  "technical-professional": {
    id: "technical-professional",
    label: "Technical Professional",
    mood: "precise, competent, modern B2B trust",
    palette: "blue, gray, and crisp brand accent colors",
    typography: "strong modern sans-serif",
    backgroundTreatment: "grid-informed precision with confident structure",
    texture: "subtle technical gradient or precision line texture",
    copyTone: "clear and competent",
    headlineExamples: ["Did we solve it right?", "Happy with our work?"],
  },
  "local-trust": {
    id: "local-trust",
    label: "Local Trust",
    mood: "approachable, community-rooted, dependable",
    palette: "brand colors with friendly local-business warmth",
    typography: "professional approachable sans-serif",
    backgroundTreatment: "clean balanced composition with community warmth",
    texture: "soft premium gradient with subtle local-business polish",
    copyTone: "friendly and community-minded",
    headlineExamples: ["Love supporting local?", "Had a great experience?"],
  },
};

const ARCHETYPE_MATCHERS: Array<{
  archetype: FlyerDesignArchetype;
  patterns: RegExp[];
}> = [
  {
    archetype: "friendly-educational",
    patterns: [/child|daycare|preschool|school|learning|tutor|education|montessori|kindergarten/i],
  },
  {
    archetype: "clinical-luxury",
    patterns: [/dent|medical|doctor|clinic|chiropract|orthodont|hospital|healthcare|therapy|counsel/i],
  },
  {
    archetype: "editorial-food",
    patterns: [/restaurant|cafe|coffee|bakery|pizza|bar\b|grill|kitchen|food|catering|brew/i],
  },
  {
    archetype: "luxury-boutique",
    patterns: [/jewel|salon|spa\b|beauty|boutique|cosmetic|nail|barber/i],
  },
  {
    archetype: "organic-minimal",
    patterns: [/wellness|yoga|massage|holistic|meditation|nutrition|acupuncture/i],
  },
  {
    archetype: "athletic-energy",
    patterns: [/gym|fitness|martial|crossfit|athletic|sport|training|pilates/i],
  },
  {
    archetype: "executive",
    patterns: [/law|attorney|legal|account|cpa|financial|insurance|consult/i],
  },
  {
    archetype: "cozy-lifestyle",
    patterns: [/book|florist|gift|pet|veterinar|coffee|tea|boutique retail/i],
  },
  {
    archetype: "modern-luxury",
    patterns: [/real estate|realtor|auto dealer|luxury|property|mortgage/i],
  },
  {
    archetype: "industrial-modern",
    patterns: [/electric|plumb|hvac|roof|contractor|construction|mechanic|garage|landscap|cleaning/i],
  },
  {
    archetype: "technical-professional",
    patterns: [/it\b|software|computer|security|marketing|agency|design studio|photograph/i],
  },
];

export function getArchetypeDefinition(archetype: FlyerDesignArchetype): ArchetypeDefinition {
  return ARCHETYPE_DEFINITIONS[archetype];
}

export function parseFlyerArchetypeOverride(
  value: unknown
): FlyerDesignArchetype | null {
  if (typeof value !== "string") return null;
  return FLYER_DESIGN_ARCHETYPES.includes(value as FlyerDesignArchetype)
    ? (value as FlyerDesignArchetype)
    : null;
}

export function resolveFlyerDesignArchetype(input: {
  primaryCategory: string;
  industry: string;
  categories?: string[];
  keywords?: string[];
}): FlyerDesignArchetype {
  const haystack = [
    input.primaryCategory,
    input.industry,
    ...(input.categories ?? []),
    ...(input.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  for (const matcher of ARCHETYPE_MATCHERS) {
    if (matcher.patterns.some((pattern) => pattern.test(haystack))) {
      return matcher.archetype;
    }
  }

  return "local-trust";
}
