export type AuditTrigger = "onboarding" | "monthly" | "weekly" | "manual";

import type { GridProfileKey } from "@/lib/google/geo-grid";

export type LocalPackPosition = 1 | 2 | 3 | "not_in_pack";

export interface ClientConfig {
  id: string;
  businessId?: string;
  name: string;
  industry: string;
  location: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  };
  keywords: string[];
  gbpPlaceId?: string;
  gbpMapsUrl?: string;
  website?: string;
  phone?: string;
  gbpConnection?: GbpConnection;
  onboardingComplete?: boolean;
  avgCustomerValue?: number | null;
  avgCustomerValueCurrency?: string;
  heatmapProfile?: GridProfileKey;
  privateFeedbackUrl?: string;
  /** Set when Google sends GOOGLE_UPDATE Pub/Sub notifications. */
  gbpGoogleUpdateAt?: string | null;
}

export interface GbpConnection {
  businessId: string;
  accountId: string;
  locationId: string;
  placeId?: string;
  googleEmail?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface GbpIdentity {
  name: string;
  address: string;
  phone: string;
  website: string;
  primaryCategory: string;
  secondaryCategories: string[];
  placeId?: string;
  mapsUrl?: string;
}

export interface GbpCompleteness {
  hasHours: boolean;
  hasFullWeekHours: boolean;
  hasHolidayHours: boolean;
  hasDescription: boolean;
  descriptionLength: number;
  hasServices: boolean;
  serviceCount: number;
  attributeCount: number;
  noPendingEdits: boolean;
  completenessScore: number;
}

export interface GbpGoogleSuggestion {
  field: string;
  label: string;
  ownerValue: string;
  googleValue: string;
  /** diff = Google shows different data; pending = owner update still processing */
  kind?: "diff" | "pending";
}

export interface GbpGoogleUpdateState {
  diffMask: string;
  pendingMask: string;
  diffFields: GbpGoogleSuggestion[];
  pendingFields: GbpGoogleSuggestion[];
}

export interface GbpMediaPreview {
  thumbnailUrl: string;
  googleUrl: string;
  mediaFormat: "PHOTO" | "VIDEO";
  category: string | null;
  description?: string;
  name?: string;
  viewCount?: number;
  isCustomerPhoto?: boolean;
  attributionName?: string;
}

export interface GbpMediaInventoryItem {
  name: string;
  category: string | null;
  mediaFormat: "PHOTO" | "VIDEO";
  thumbnailUrl: string;
  googleUrl: string;
  viewCount: number;
  isCustomerPhoto: boolean;
  attributionName?: string;
  createTime: string;
}

export interface GbpMediaCoverage {
  totalCount: number;
  ownerPhotoCount: number;
  customerPhotoCount: number;
  hasCover: boolean;
  hasLogo: boolean;
  hasExterior: boolean;
  hasInterior: boolean;
  hasTeam: boolean;
  hasAtWork: boolean;
  hasVideo: boolean;
  categoryCount: number;
  missingCategories: string[];
  coverageScore: number;
  totalViews: number;
  ownerTotalViews: number;
  ownerAvgViews: number;
  ownerZeroViewCount: number;
  customerPhotoShare: number;
  engagementScore: number;
  daysSinceLastUpload: number | null;
}

export interface GbpContent {
  photoCount: number;
  videoCount: number;
  photosByType: Record<string, number>;
  lastPhotoUpload: string | null;
  mediaPreviews?: GbpMediaPreview[];
  mediaCoverage?: GbpMediaCoverage;
  totalMediaItemCount?: number;
  mediaInventory?: GbpMediaInventoryItem[];
  postCount: number;
  lastPostDate: string | null;
}

export interface GbpEngagement {
  reviewCount: number;
  averageRating: number;
  reviewsLast30Days: number;
  reviewsLast90Days: number;
  responseRate: number;
  avgResponseTimeHours: number;
}

export interface GbpPerformance {
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  profileViews: number;
  impressionsMaps: number;
  impressionsSearch: number;
  conversations: number;
  bookings: number;
  periodDays: number;
  searchKeywords?: Array<{
    keyword: string;
    impressions: number | null;
    belowThreshold: boolean;
  }>;
  source?: "api" | "unavailable";
  error?: string;
  warnings?: string[];
  accessCheck?: import("@/lib/google/gbp-access").GbpLocationAccessCheck;
  coverage?: GbpPerformanceCoverage;
}

export interface GbpPerformanceCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  hasCoreMetrics: boolean;
  hasImpressionMetrics: boolean;
  hasSearchKeywords: boolean;
  hasConversations: boolean;
  hasBookings: boolean;
  keywordCount: number;
  trackedKeywordCount: number;
  totalActions: number;
  actionRate: number;
  endpoints: {
    coreMetrics: string;
    impressions: string;
    searchKeywords: string;
  };
  recommendations: string[];
}

export interface GbpIssues {
  isSuspended: boolean;
  isVerified: boolean;
  hasDuplicateListings: boolean;
  napInconsistencies: string[];
}

export interface GbpServiceItem {
  name: string;
  description: string;
}

export interface GbpPostItem {
  createTime: string;
  summary: string;
  name?: string;
  topicType?: string;
  state?: string;
  searchUrl?: string;
  actionType?: string;
}

/** Live profile data pulled from GBP OAuth Business Information API. */
export interface GbpLiveProfile {
  primaryCategory: string;
  secondaryCategories: string[];
  description: string;
  services: GbpServiceItem[];
  attributes: string[];
  source: "oauth" | "places";
}

export interface GbpAttributeCoverageItem {
  name: string;
  displayName: string;
  groupDisplayName: string;
  valueType: string;
  autoApplicable: boolean;
}

export interface GbpConfiguredProfileLink {
  name: string;
  displayName: string;
  groupDisplayName: string;
  valueType: string;
  uri: string;
  platform?: string;
}

export interface GbpAttributeCoverage {
  enabledCount: number;
  availableCount: number;
  missingCount: number;
  enabled: GbpAttributeCoverageItem[];
  missing: GbpAttributeCoverageItem[];
  profileLinkMissing: GbpAttributeCoverageItem[];
  configuredProfileLinks: GbpConfiguredProfileLink[];
  supportedAttributeNames: string[];
  autoUpdates: Array<{
    name: string;
    boolValue?: boolean;
    uri?: string;
    enumValues?: string[];
  }>;
}

export interface GbpNotificationCoverage {
  configured: boolean;
  pubsubTopic: string | null;
  enabledTypes: string[];
  missingRecommendedTypes: string[];
  deprecatedTypesEnabled: string[];
  coverageScore: number;
  hasReviewAlerts: boolean;
  hasGoogleUpdateAlerts: boolean;
  hasCustomerMediaAlerts: boolean;
  hasVoiceOfMerchantAlerts: boolean;
}

export interface GbpPlaceActionCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  linkCount: number;
  merchantLinkCount: number;
  configuredTypes: string[];
  availableTypes: string[];
  missingRecommendedTypes: string[];
  missingAvailableTypes: string[];
  typeCatalog: Array<{
    placeActionType: string;
    displayName: string;
  }>;
  hasAppointmentLink: boolean;
  hasOnlineAppointmentLink: boolean;
  hasDiningReservationLink: boolean;
  hasFoodOrderingLink: boolean;
  hasShopOnlineLink: boolean;
  endpoints: {
    links: string;
    typeMetadata: string;
  };
  recommendations: string[];
}

export interface GbpPlaceActionLinkSummary {
  name: string;
  uri: string;
  placeActionType: string;
  displayType: string;
  isPreferred?: boolean;
  isEditable?: boolean;
  providerType?: string;
}

export interface GbpLocalPostCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  postCount: number;
  livePostCount: number;
  rejectedPostCount: number;
  processingPostCount: number;
  postsLast30Days: number;
  daysSinceLastPost: number | null;
  topicTypesUsed: string[];
  hasOfferPost: boolean;
  hasEventPost: boolean;
  hasCallToActionPosts: boolean;
  hasMediaPosts: boolean;
  totalViews: number | null;
  endpoints: {
    list: string;
    insights: string;
  };
  recommendations: string[];
}

export interface GbpReviewCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  reviewCount: number;
  averageRating: number;
  responseRate: number;
  unrespondedCount: number;
  unrespondedNegativeCount: number;
  pendingReplies: number;
  rejectedReplies: number;
  reviewsLast30Days: number;
  reviewsWithMedia: number;
  avgResponseTimeHours: number | null;
  endpoints: {
    list: string;
    get: string;
  };
  recommendations: string[];
}

/** Status for a single Google Location API field in the profile inventory. */
export type GbpLocationFieldStatus =
  | "good"
  | "needs_work"
  | "missing"
  | "blocked"
  | "conflict"
  | "processing";

/** One checkable field aligned to Google's Business Information Location resource. */
export interface GbpLocationInventoryField {
  /** API path, e.g. profile.description */
  apiPath: string;
  /** Human label for UI */
  label: string;
  /** Section grouping in the inventory panel */
  section:
    | "identity"
    | "profile"
    | "hours"
    | "services"
    | "attributes"
    | "service_area"
    | "status"
    | "engagement"
    | "performance";
  current: string;
  status: GbpLocationFieldStatus;
  /** Google's constraints or guidance for this field */
  constraint?: string;
  /** Whether the field can be updated via our GBP apply actions */
  editable: boolean;
  /** profile.description in diffMask / pendingMask */
  hasConflict?: boolean;
  isProcessing?: boolean;
  /** Estimated driver-score points if this field is fixed */
  scoreImpact?: number;
  scoreComponent?: ScoreComponent;
  /** Estimated monthly revenue lift when avg job value is known */
  revenueImpact?: number;
  /** Confidence when field weight is calibrated from attribution */
  calibrationConfidence?: import("./phase2/attribution-calibration").CalibrationConfidence;
  /** Take Action plan step that fixes this field */
  planStepNumber?: number;
  planTaskId?: string;
  planTaskStatus?: ExecutionStatus;
  planFixLabel?: string;
  planScrollTarget?: "google-updates";
  /** Secondary detail for inventory rows (e.g. attributes not yet enabled). */
  missingCurrent?: string;
}

export interface GbpLocationInventory {
  collectedAt: string;
  source: "oauth" | "places" | "mixed";
  fields: GbpLocationInventoryField[];
  summary: {
    total: number;
    good: number;
    needsWork: number;
    missing: number;
    conflict: number;
    processing: number;
    blocked: number;
    /** Sum of scoreImpact across fields that need work */
    potentialScoreGain?: number;
    /** Sum of revenueImpact when avg customer value is set */
    potentialRevenueGain?: number;
  };
}

export interface GbpSnapshot {
  collectedAt: string;
  identity: GbpIdentity;
  completeness: GbpCompleteness;
  content: GbpContent;
  engagement: GbpEngagement;
  performance: GbpPerformance;
  issues: GbpIssues;
  liveProfile?: GbpLiveProfile;
  recentPosts?: GbpPostItem[];
  googleSuggestions?: GbpGoogleSuggestion[];
  googleUpdateState?: GbpGoogleUpdateState;
  hasGoogleUpdated?: boolean;
  notifications?: GbpNotificationCoverage;
  placeActions?: GbpPlaceActionCoverage;
  placeActionLinks?: GbpPlaceActionLinkSummary[];
  localPosts?: GbpLocalPostCoverage;
  reviewCoverage?: GbpReviewCoverage;
  locationInventory?: GbpLocationInventory;
  napDrift?: Array<{
    field: string;
    label: string;
    canonical: string;
    live: string;
  }>;
  attributeCoverage?: GbpAttributeCoverage;
}

export interface GeoRankPoint {
  distanceMiles: number;
  rank: number | null;
  inLocalPack: boolean;
}

/** Competitor in the Local 3-Pack at a geo-grid cell. */
export interface GeoGridLocalPackEntry {
  placeId: string;
  name: string;
  position: number;
  rating: number | null;
  reviewCount: number;
}

/** Spatial rank sample at a grid point around the business (geo heatmap). */
export interface GeoGridPoint {
  lat: number;
  lng: number;
  offsetNorthMiles: number;
  offsetEastMiles: number;
  rank: number | null;
  inLocalPack: boolean;
  /** Top competitors in this cell's result set (when collected with local pack data). */
  localPack?: GeoGridLocalPackEntry[];
}

export interface KeywordRankSnapshot {
  keyword: string;
  localPackPosition: LocalPackPosition | number;
  inLocalPack: boolean;
  geoRanks: GeoRankPoint[];
  /** 5×5 spatial grid for heatmap visualization (optional on older audits). */
  geoGrid?: GeoGridPoint[];
  packLeaderRating: number;
  packLeaderReviewCount: number;
  clientRating: number;
  clientReviewCount: number;
}

export interface RankSnapshot {
  collectedAt: string;
  keywords: KeywordRankSnapshot[];
  shareOfVoice: number;
  keywordsInPack: number;
  totalKeywords: number;
}

export interface CompetitorProfile {
  name: string;
  placeId: string;
  averageRating: number;
  reviewCount: number;
  newReviewsThisMonth: number;
  postsLast30Days: number;
  photoCount: number;
  lastPostDate: string | null;
  primaryCategory: string;
  descriptionLength: number;
  attributeCount: number;
  mapPositions: Record<string, number | "not_in_pack">;
  reviewThemes: string[];
}

export interface CompetitorSnapshot {
  collectedAt: string;
  competitors: CompetitorProfile[];
  keyword: string;
}

export interface ReviewMediaItem {
  thumbnailUrl: string;
  thumbnailLabel?: string;
  videoUrl?: string;
}

export type ReviewReplyState =
  | "REVIEW_REPLY_STATE_UNSPECIFIED"
  | "PENDING"
  | "REJECTED"
  | "APPROVED";

export interface ReviewRecord {
  id: string;
  resourceName?: string;
  rating: number;
  text: string;
  author: string;
  authorPhotoUrl?: string;
  isAnonymous?: boolean;
  publishedAt: string;
  updatedAt?: string;
  responded: boolean;
  replyText?: string;
  replyUpdatedAt?: string;
  replyState?: ReviewReplyState;
  policyViolation?: string;
  responseTimeHours: number | null;
  sentiment: "positive" | "neutral" | "negative";
  mediaItems?: ReviewMediaItem[];
}

export interface ReviewSentimentSummary {
  positiveThemes: string[];
  negativeThemes: string[];
  praiseCount: number;
  complaintCount: number;
  neutralCount: number;
}

export interface ReviewSnapshot {
  collectedAt: string;
  reviews: ReviewRecord[];
  sentiment: ReviewSentimentSummary;
  unrespondedNegative: number;
  disputeCandidates: string[];
  velocityVsPriorMonth: number;
  avgResponseTimeHours: number | null;
  pendingReplies: number;
  rejectedReplies: number;
  coverage?: GbpReviewCoverage;
}

export interface WebsiteSignals {
  napMatch: boolean;
  hasLocalBusinessSchema: boolean;
  hasLocalLandingPage: boolean;
  issues: string[];
}

export interface OffGoogleSnapshot {
  collectedAt: string;
  website: WebsiteSignals;
  socialPostCountLast30Days: number;
}

export interface Phase1AuditPayload {
  clientId: string;
  clientName: string;
  userId?: string;
  auditId: string;
  trigger: AuditTrigger;
  period: string;
  startedAt: string;
  completedAt: string;
  gbp: GbpSnapshot;
  rankings: RankSnapshot;
  competitors: CompetitorSnapshot[];
  reviews: ReviewSnapshot;
  offGoogle: OffGoogleSnapshot;
  /** Per-keyword profile relevance signals (LLM + heuristic), cached on audit payload. */
  keywordRelevance?: KeywordRelevanceFeatures[];
}

/** Structured relevance features for one tracked keyword — feeds conversion scoring. */
export interface KeywordRelevanceFeatures {
  keyword: string;
  /** 0–100 blended relevance score */
  score: number;
  /** Primary/secondary category alignment with keyword intent (0–100) */
  categoryFit: number;
  /** Enabled GBP attributes aligned with keyword intent (0–100) */
  attributeFit?: number;
  servicesCoverage: boolean;
  descriptionCoverage: boolean;
  /** Reviews in corpus mentioning this keyword or its core terms */
  reviewMentions: number;
  postCoverage: boolean;
  /** What top pack competitors have that this profile lacks */
  competitorGaps: string[];
  recommendation: string | null;
  source: "llm" | "heuristic" | "hybrid";
}

export interface AuditRunResult {
  success: boolean;
  audit: FullAuditPayload;
  storagePath: string;
}

// ─── Phase 2: Scoring & Strategy ───────────────────────────────────────────

export type HealthGrade = "healthy" | "at_risk" | "urgent";
export type ScoreComponent =
  | "visibility"
  | "conversion"
  | "revenueCapture"
  | "driver"
  | "outcome";

export interface ScoreInsight {
  weakestComponent: ScoreComponent;
  topOpportunityKeyword: string | null;
  nextAction: string | null;
}

export interface KeywordScoreCard {
  keyword: string;
  visibilityScore: number;
  revenueCaptureScore: number;
  /** Profile relevance for this keyword (0–100) */
  relevanceScore: number;
  /** 1-mile Nearby Search position (pack badge) */
  position: number | "not_in_pack";
  positionLabel: string;
  inLocalPack: boolean;
  impressions: number | null;
  impressionsLabel: string;
  estimatedMonthlyRevenue: number | null;
  potentialAtRank1: number | null;
  scoreImpactIfRank1: number;
  suggestedAction: string;
  /** Share of geo-grid cells in Local 3-Pack, when grid data exists */
  gridCoveragePercent?: number | null;
  /** Ranks at 1/3/5/10 mi used for service-area scoring */
  radiusRanks: Array<{
    distanceMiles: number;
    rank: number | "not_in_pack";
    inLocalPack: boolean;
    label: string;
  }>;
  /** How customer travel distance is weighted in the score */
  radiusProfileLabel: string;
  packFragile: boolean;
  weakestRadiusMiles: number | null;
}

export type PathOptimizationMode = "driver" | "outcome" | "revenue" | "balanced";

export interface PathOptimizationBlendWeights {
  driver: number;
  outcome: number;
  revenue: number;
}

/** Marginal score/revenue deltas from adding one action on top of a selected set. */
export interface ActionMarginalImpact {
  driverGain: number;
  outcomeGain: number;
  visibilityGain: number;
  revenueCaptureGain: number;
  revenueGain: number | null;
  overallGain: number;
}

export interface PathToHealthyOptions {
  avgCustomerValue?: number | null;
  currency?: string;
  calibration?: import("./phase2/attribution-calibration").AttributionCalibration;
  gapCalibration?: import("./phase2/attribution-calibration").GapAttributionCalibration;
  mode?: PathOptimizationMode;
  blendWeights?: PathOptimizationBlendWeights;
  targetOutcomeIndex?: number;
  targetRevenueGain?: number | null;
}

export interface PathToHealthyStep {
  id: string;
  title: string;
  scoreImpact: number;
  source: "gap" | "plan";
  priority?: string;
  order: number;
  driverImpact?: number;
  outcomeImpact?: number;
  revenueImpact?: number | null;
  revenueImpactLabel?: string | null;
  gapId?: string;
  keyword?: string;
}

export interface PathToHealthy {
  targetScore: number;
  /** Headline listing strength (driver + outcome blend) */
  currentScore: number;
  /** Controllable profile strength — target for path steps */
  currentDriverScore: number;
  /** Rank-derived results (visibility + revenue capture) */
  outcomeIndex: number;
  pointsNeeded: number;
  projectedScore: number;
  projectedDriverScore: number;
  projectedOutcomeIndex: number;
  steps: PathToHealthyStep[];
  estimatedRevenueGain: number | null;
  estimatedRevenueGainLabel: string | null;
  topKeywords: KeywordScoreCard[];
  alreadyHealthy: boolean;
  /** How actions were prioritized when building this path */
  optimizationMode?: PathOptimizationMode;
  /** Current estimated monthly revenue at existing ranks (requires ACV) */
  estimatedMonthlyRevenue?: number | null;
  /** Projected monthly revenue after path actions (requires ACV) */
  projectedMonthlyRevenue?: number | null;
  currentRevenueCapture?: number;
  projectedRevenueCapture?: number;
  calibrationConfidence?: import("./phase2/attribution-calibration").CalibrationConfidence;
}

export interface EngagementOutcomes {
  calls: number;
  directions: number;
  websiteClicks: number;
  profileViews: number;
}

export interface HealthScores {
  overall: number;
  grade: HealthGrade;
  /** Controllable profile + relevance signals (predicts future rank movement) */
  driverScore: number;
  /** Rank-derived results: visibility + revenue capture */
  outcomeIndex: number;
  /** Weighted keyword rankings — outcome input */
  visibility: number;
  /** Profile trust + relevance — driver input */
  conversion: number;
  /** Impression-weighted share of map clicks captured — outcome input */
  revenueCapture: number;
  insight: ScoreInsight;
  /** Legacy / diagnostic fields */
  gbpCompleteness: number;
  localPackCoverage: number;
  reviewStrength: number;
  /** Raw 30d engagement totals (outcomes, not score inputs) */
  engagement: number;
  competitiveGap: number;
  engagementOutcomes: EngagementOutcomes;
}

export type ActionPriority = "P0" | "P1" | "P2" | "P3";
export type ActionCategory =
  | "gbp_profile"
  | "content"
  | "reviews"
  | "rankings"
  | "social"
  | "disputes"
  | "technical";

export interface GapFlag {
  id: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  description: string;
  impact: number;
  effort: number;
  impactScore: number;
  scoreComponent?: ScoreComponent;
  scoreImpact?: number;
}

export interface ActionItem {
  id: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  description: string;
  owner: "system" | "client" | "account_manager";
  dueDays: number;
  expectedImpact: string;
  draftCopy?: string;
}

export interface RankMovement {
  keyword: string;
  fromPosition: number | null;
  toPosition: number | null;
  improved: boolean;
  /** Service-area visibility score (0–100) when multi-radius data is available */
  fromServiceAreaVisibility?: number;
  toServiceAreaVisibility?: number;
  /** Radius to highlight in changelog copy (1 mi or widest improved ring) */
  highlightRadiusMiles?: number | null;
}

export interface CompetitorDelta {
  competitorName: string;
  competitorReviewGain: number;
  clientReviewGain: number;
}

export interface EngagementMetricDelta {
  current: number;
  prior: number;
  change: number;
  changePercent: number | null;
}

export interface MonthOverMonthDelta {
  keywordsInPackChange: number;
  reviewCountChange: number;
  callsChange: number;
  directionRequestsChange: number;
  websiteClicksChange: number;
  shareOfVoiceChange: number;
  overallScoreChange: number;
  visibilityScoreChange: number;
  conversionScoreChange: number;
  revenueCaptureScoreChange: number;
  improvedKeywords: string[];
  declinedKeywords: string[];
  rankMovements: RankMovement[];
  competitorDeltas: CompetitorDelta[];
  scoreChangelog?: ScoreChangelogEntry[];
}

export interface ScoreChangelogEntry {
  component: ScoreComponent | "overall";
  delta: number;
  label: string;
  keyword?: string;
}

export interface MonthlyReport {
  generatedAt: string;
  hasPriorPeriod: boolean;
  priorPeriod: string | null;
  headline: string;
  rankMovements: RankMovement[];
  engagement: {
    calls: EngagementMetricDelta;
    directions: EngagementMetricDelta;
    websiteClicks: EngagementMetricDelta;
  };
  competitorDeltas: CompetitorDelta[];
  nextMonthPlan: ActionItem[];
  contentSource?: "llm" | "template";
}

export interface GbpPlanCopyBlock {
  label: string;
  content: string;
}

export type GbpPlanActionType =
  | "update_primary_category"
  | "add_secondary_categories"
  | "update_description"
  | "add_service_items"
  | "upload_photo"
  | "upload_video"
  | "update_attributes"
  | "update_website"
  | "update_hours"
  | "accept_google_suggestion"
  | "update_booking_attributes"
  | "create_post"
  | "manual";

export interface GbpPlanActionData {
  primaryCategory?: string;
  secondaryCategories?: string[];
  description?: string;
  postSummary?: string;
  websiteUri?: string;
  bookingUri?: string;
  serviceName?: string;
  serviceDescription?: string;
  sourceUrl?: string;
  mediaCategory?: string;
  attributes?: Array<{
    name: string;
    boolValue?: boolean;
    uri?: string;
    enumValues?: string[];
  }>;
}

export interface GbpPlanStep {
  stepNumber: number;
  title: string;
  instruction: string;
  current?: string;
  recommended?: string;
  bullets?: string[];
  copyBlocks?: GbpPlanCopyBlock[];
  gbpAction?: GbpPlanActionType;
  actionData?: GbpPlanActionData;
}

export interface GbpKeywordPriority {
  rank: number;
  keyword: string;
  reason: string;
}

export interface GbpProfileField {
  label: string;
  current: string;
  status: "good" | "needs_work" | "missing";
}

export interface GbpCurrentStateSummary {
  fields: GbpProfileField[];
  profileGaps: string[];
}

export interface KeywordRankAnalysis {
  keyword: string;
  inLocalPack: boolean;
  position: string;
  rankAt1Mi: number | null;
  rankAt3Mi: number | null;
  rankAt5Mi: number | null;
  packLeaderReviews: number;
  clientReviews: number;
  reviewGap: number;
  gbpUpdates: string[];
  /** In pack at 1 mi but drops off at wider search radii */
  packFragile: boolean;
  weakestRadiusMiles: number | null;
}

export interface GbpOptimizationPlan {
  title: string;
  businessName: string;
  address: string;
  objective: string;
  targetKeywords: string[];
  currentState: GbpCurrentStateSummary;
  keywordRankings: KeywordRankAnalysis[];
  steps: GbpPlanStep[];
  keywordPriority: GbpKeywordPriority[];
  weeklyCadence: string[];
  monthlyCadence: string[];
  contentSource?: "llm" | "template";
}

// ─── Unified Plan (computed from gbpPlan + execution_tasks) ────────────────

export type PlanPhaseId = "foundation" | "content" | "reputation" | "ongoing";

export type PlanStepStatus =
  | "pending"
  | "needs_approval"
  | "approved"
  | "completed"
  | "skipped";

export interface PlanPhase {
  id: PlanPhaseId;
  title: string;
  stepNumbers: number[];
}

export interface PlanStepContext {
  targetKeywords: string[];
  primaryKeyword?: string;
  expectedEffect: string;
  currentValue?: string;
  recommendedValue?: string;
  healthScoreImpact?: number;
  outcomeScoreImpact?: number;
  revenueImpact?: number | null;
}

export interface PlanStepOutcome {
  publishedAt: string;
  attributionId?: string;
  rankBefore?: number | null;
  rankAfter?: number | null;
  keyword?: string;
  narrative?: string;
  projectedDriverImpact?: number | null;
  observedDriverImpact?: number | null;
  driverScoreBefore?: number | null;
  driverScoreAfter?: number | null;
}

export interface PlanStep {
  stepNumber: number;
  phaseId: PlanPhaseId;
  title: string;
  instruction: string;
  context: PlanStepContext;
  gbpAction?: GbpPlanActionType;
  actionData?: GbpPlanActionData;
  copyBlocks?: GbpPlanCopyBlock[];
  bullets?: string[];
  tasks: ExecutionTask[];
  status: PlanStepStatus;
  outcome?: PlanStepOutcome;
}

export interface PlanProgress {
  totalSteps: number;
  completedSteps: number;
  needsApproval: number;
  currentHealthScore: number;
  projectedHealthScore: number;
}

export interface Plan {
  title: string;
  businessName: string;
  objective: string;
  targetKeywords: string[];
  phases: PlanPhase[];
  steps: PlanStep[];
  progress: PlanProgress;
}

export interface StrategyReport {
  generatedAt: string;
  executiveSummary: string;
  biggestWin: string | null;
  biggestThreat: string;
  localPackStatus: string;
  kpiTargets: string[];
  scores: HealthScores;
  gaps: GapFlag[];
  actionPlan: ActionItem[];
  monthOverMonth: MonthOverMonthDelta | null;
  monthlyReport: MonthlyReport | null;
  gbpPlan: GbpOptimizationPlan | null;
  contentSource?: "llm" | "template";
}

export interface FullAuditPayload extends Phase1AuditPayload {
  strategy: StrategyReport;
  execution?: Phase3ExecutionReport;
}

// ─── Phase 3: Execution & Approval Queue ───────────────────────────────────

export type ExecutionStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled"
  | "completed"
  | "failed";

export type ExecutionType =
  | "google_post"
  | "gbp_description"
  | "gbp_primary_category"
  | "gbp_secondary_categories"
  | "gbp_services"
  | "gbp_photo"
  | "gbp_video"
  | "gbp_media_recategorize"
  | "gbp_media_delete"
  | "gbp_notifications"
  | "gbp_place_action"
  | "gbp_attributes"
  | "gbp_website"
  | "gbp_phone"
  | "gbp_hours"
  | "gbp_accept_suggestion"
  | "gbp_reject_suggestion"
  | "gbp_title"
  | "gbp_address"
  | "gbp_checklist"
  | "review_response"
  | "review_delete_reply"
  | "review_request"
  | "schema_markup"
  | "social_post";

export interface ExecutionTask {
  id: string;
  auditId: string;
  actionItemId: string;
  type: ExecutionType;
  title: string;
  description: string;
  priority: ActionPriority;
  status: ExecutionStatus;
  draftContent: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
  scheduledFor: string | null;
  completedAt: string | null;
  result: string | null;
  createdAt: string;
  planStepNumber?: number | null;
  planPhaseId?: PlanPhaseId | null;
}

export interface Phase3ExecutionReport {
  generatedAt: string;
  tasksCreated: number;
  pendingApproval: number;
  autoApproved: number;
  tasks: ExecutionTask[];
  contentSource?: "llm" | "template";
}
