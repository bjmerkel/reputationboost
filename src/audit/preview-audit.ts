import type {
  ClientConfig,
  CompetitorSnapshot,
  FullAuditPayload,
  KeywordRankSnapshot,
  OffGoogleSnapshot,
  Phase1AuditPayload,
  ReviewSnapshot,
} from "./types";
import { collectGbpFromPlaceDetails } from "./collectors/gbp";
import { ensureStrategy } from "./ensure-strategy";
import { computeHealthScores } from "./phase2/scoring";
import { detectGaps } from "./phase2/gaps";
import { suggestKeywords } from "@/lib/llm/keywords";
import {
  extractCompetitors,
  isOwnBusiness,
  searchKeywordAtAllRadii,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { collectKeywordGeoGrid } from "@/lib/google/geo-grid";
import { primaryCategoryFromTypes } from "@/lib/google/place-details";

const PREVIEW_KEYWORD_COUNT = 3;
const HEALTHY_TARGET = 70;
const REVENUE_PER_POINT = 168; // ~$4,200 for a 25-point gain (47 → 72)

export interface PreviewAuditInput {
  placeId: string;
  name: string;
  industry?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
}

export interface PreviewKeywordResult {
  keyword: string;
  rank: number | null;
  inLocalPack: boolean;
  localPackPosition: number | "not_in_pack";
  packLeaderReviewCount: number;
  clientReviewCount: number;
}

export interface PreviewAuditResult {
  business: {
    name: string;
    address: string;
    industry: string;
    placeId: string;
  };
  score: {
    overall: number;
    grade: "healthy" | "at_risk" | "urgent";
    driverScore: number;
    outcomeIndex: number;
  };
  keywords: PreviewKeywordResult[];
  topGap: {
    title: string;
    description: string;
    scoreImpact: number;
  } | null;
  pathToHealthy: {
    currentScore: number;
    projectedScore: number;
    pointsNeeded: number;
    estimatedRevenueGain: number | null;
    topActions: Array<{ title: string; scoreImpact: number }>;
  };
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  platformAudit: FullAuditPayload;
}

function emptyReviewsSnapshot(): ReviewSnapshot {
  const now = new Date().toISOString();
  return {
    collectedAt: now,
    reviews: [],
    sentiment: {
      positiveThemes: [],
      negativeThemes: [],
      praiseCount: 0,
      complaintCount: 0,
      neutralCount: 0,
    },
    unrespondedNegative: 0,
    disputeCandidates: [],
    velocityVsPriorMonth: 0,
    avgResponseTimeHours: null,
    pendingReplies: 0,
    rejectedReplies: 0,
  };
}

function neutralOffGoogleSnapshot(): OffGoogleSnapshot {
  return {
    collectedAt: new Date().toISOString(),
    citations: [],
    citationConsistencyScore: 100,
    website: {
      napMatch: true,
      hasLocalBusinessSchema: true,
      hasLocalLandingPage: true,
      issues: [],
    },
    socialPostCountLast30Days: 4,
  };
}

function buildClientConfig(input: PreviewAuditInput, industry: string): ClientConfig {
  return {
    id: "preview",
    name: input.name,
    industry,
    location: {
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      lat: input.lat,
      lng: input.lng,
    },
    keywords: [],
    gbpPlaceId: input.placeId,
    website: input.website,
    phone: input.phone,
  };
}

async function collectPreviewRankings(
  keywords: string[],
  location: { lat: number; lng: number },
  matchOptions: BusinessMatchOptions
): Promise<{ keywords: KeywordRankSnapshot[]; competitors: CompetitorSnapshot[] }> {
  const now = new Date().toISOString();
  const keywordSnapshots: KeywordRankSnapshot[] = [];
  const competitorSnapshots: CompetitorSnapshot[] = [];

  for (let index = 0; index < keywords.length; index++) {
    const keyword = keywords[index];
    const { ranksByRadius, resultsByRadius } = await searchKeywordAtAllRadii(
      keyword,
      location,
      matchOptions,
      "nearby"
    );

    const rankAt1Mi = ranksByRadius[1];
    const inLocalPack = rankAt1Mi !== null && rankAt1Mi <= 3;
    const localPackPosition = inLocalPack ? (rankAt1Mi as 1 | 2 | 3) : "not_in_pack";
    const resultsAt1Mi = resultsByRadius[1];
    const leader = resultsAt1Mi[0];
    const ownPlace = resultsAt1Mi.find((place) => isOwnBusiness(place, matchOptions));

    const geoGrid =
      index === 0
        ? await collectKeywordGeoGrid(keyword, location, matchOptions).catch(() => undefined)
        : undefined;

    keywordSnapshots.push({
      keyword,
      localPackPosition,
      inLocalPack,
      geoRanks: [1, 3, 5, 10].map((distanceMiles) => {
        const rank = ranksByRadius[distanceMiles as 1 | 3 | 5 | 10];
        return {
          distanceMiles: distanceMiles as 1 | 3 | 5 | 10,
          rank,
          inLocalPack: rank !== null && rank <= 3,
        };
      }),
      packLeaderRating: leader?.rating ?? 0,
      packLeaderReviewCount: leader?.reviewCount ?? 0,
      clientRating: ownPlace?.rating ?? 0,
      clientReviewCount: ownPlace?.reviewCount ?? 0,
      geoGrid,
    });

    const competitorPlaces = extractCompetitors(resultsAt1Mi, matchOptions, 5);
    competitorSnapshots.push({
      collectedAt: now,
      keyword,
      competitors: competitorPlaces.map((place) => ({
        name: place.name,
        placeId: place.placeId,
        averageRating: place.rating ?? 0,
        reviewCount: place.reviewCount,
        newReviewsThisMonth: 0,
        postsLast30Days: 0,
        photoCount: 0,
        lastPostDate: null,
        primaryCategory: primaryCategoryFromTypes(place.types),
        descriptionLength: 0,
        attributeCount: 0,
        mapPositions: {
          [keyword]: place.position <= 3 ? (place.position as 1 | 2 | 3) : "not_in_pack",
        },
        reviewThemes: [],
      })),
    });
  }

  const keywordsInPack = keywordSnapshots.filter((k) => k.inLocalPack).length;

  return {
    keywords: keywordSnapshots,
    competitors: competitorSnapshots,
  };
}

function buildPreviewAuditPayload(
  client: ClientConfig,
  gbp: Awaited<ReturnType<typeof collectGbpFromPlaceDetails>>,
  rankings: KeywordRankSnapshot[],
  competitors: CompetitorSnapshot[]
): Phase1AuditPayload {
  const now = new Date().toISOString();
  const keywordsInPack = rankings.filter((k) => k.inLocalPack).length;

  return {
    clientId: "preview",
    clientName: client.name,
    auditId: `preview-${now.slice(0, 10)}`,
    trigger: "manual",
    period: "Preview",
    startedAt: now,
    completedAt: now,
    gbp: {
      ...gbp,
      engagement: {
        ...gbp.engagement,
        responseRate: Math.max(gbp.engagement.responseRate, 0.85),
      },
    },
    rankings: {
      collectedAt: now,
      keywords: rankings,
      shareOfVoice: rankings.length
        ? Math.round((keywordsInPack / rankings.length) * 100)
        : 0,
      keywordsInPack,
      totalKeywords: rankings.length,
    },
    competitors,
    reviews: emptyReviewsSnapshot(),
    offGoogle: neutralOffGoogleSnapshot(),
  };
}

const PREVIEW_GAP_PREFIXES = [
  "rank-outside-pack-",
  "relevance-gap-",
  "review-gap-",
  "stale-posts",
  "low-photos",
  "unresponded-negative",
  "low-response-rate",
  "unanswered-qa",
];

function isPreviewRelevantGap(id: string): boolean {
  return PREVIEW_GAP_PREFIXES.some((prefix) =>
    prefix.endsWith("-") ? id.startsWith(prefix) : id === prefix
  );
}

export async function runPreviewAudit(input: PreviewAuditInput): Promise<PreviewAuditResult> {
  if (!isGoogleMapsConfigured()) {
    throw new Error("Google Maps API is not configured.");
  }

  const industry = input.industry?.trim() || "local business";
  const client = buildClientConfig(input, industry);

  const [{ keywords: keywordSuggestions }, gbp] = await Promise.all([
    suggestKeywords({
      name: input.name,
      industry,
      city: input.city,
      state: input.state,
      address: input.address,
      website: input.website,
    }),
    collectGbpFromPlaceDetails(client),
  ]);

  const keywords = keywordSuggestions.slice(0, PREVIEW_KEYWORD_COUNT).map((k) => k.keyword);
  client.keywords = keywords;

  const matchOptions: BusinessMatchOptions = {
    businessName: input.name,
    placeId: input.placeId,
    businessAddress: input.address,
  };

  const location = { lat: input.lat, lng: input.lng };
  const { keywords: rankings, competitors } = await collectPreviewRankings(
    keywords,
    location,
    matchOptions
  );

  const audit = buildPreviewAuditPayload(client, gbp, rankings, competitors);
  const scores = computeHealthScores(audit);
  const gaps = detectGaps(audit).filter((g) => isPreviewRelevantGap(g.id));

  const topActions = gaps.slice(0, 3).map((gap) => ({
    title: gap.title,
    scoreImpact: gap.scoreImpact ?? gap.impact,
  }));

  const pointsFromActions = topActions.reduce((sum, action) => sum + action.scoreImpact, 0);
  const pointsNeeded = Math.max(0, HEALTHY_TARGET - scores.driverScore);
  const projectedScore = Math.min(
    85,
    scores.overall + Math.min(pointsFromActions, pointsNeeded + 5)
  );
  const estimatedRevenueGain =
    projectedScore > scores.overall
      ? Math.round((projectedScore - scores.overall) * REVENUE_PER_POINT)
      : null;

  const topGap = gaps[0]
    ? {
        title: gaps[0].title,
        description: gaps[0].description,
        scoreImpact: gaps[0].scoreImpact ?? gaps[0].impact,
      }
    : null;

  const platformAudit = ensureStrategy({ ...audit } as FullAuditPayload);
  const fullAddress =
    gbp.identity.address ||
    [input.address, input.city, input.state, input.zip].filter(Boolean).join(", ");

  return {
    business: {
      name: gbp.identity.name || input.name,
      address: gbp.identity.address,
      industry: gbp.identity.primaryCategory || industry,
      placeId: input.placeId,
    },
    score: {
      overall: scores.overall,
      grade: scores.grade,
      driverScore: scores.driverScore,
      outcomeIndex: scores.outcomeIndex,
    },
    keywords: rankings.map((kw) => ({
      keyword: kw.keyword,
      rank: typeof kw.localPackPosition === "number" ? kw.localPackPosition : kw.geoRanks[0]?.rank ?? null,
      inLocalPack: kw.inLocalPack,
      localPackPosition: kw.localPackPosition,
      packLeaderReviewCount: kw.packLeaderReviewCount,
      clientReviewCount: kw.clientReviewCount,
    })),
    topGap,
    pathToHealthy: {
      currentScore: scores.overall,
      projectedScore,
      pointsNeeded,
      estimatedRevenueGain,
      topActions,
    },
    location: {
      lat: input.lat,
      lng: input.lng,
      address: fullAddress,
    },
    platformAudit,
  };
}
