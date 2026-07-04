export type AuditTrigger = "onboarding" | "monthly" | "weekly" | "manual";

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
}

export interface GbpMediaPreview {
  thumbnailUrl: string;
  googleUrl: string;
  mediaFormat: "PHOTO" | "VIDEO";
  category: string | null;
  description?: string;
}

export interface GbpContent {
  photoCount: number;
  videoCount: number;
  photosByType: Record<string, number>;
  lastPhotoUpload: string | null;
  mediaPreviews?: GbpMediaPreview[];
  postCount: number;
  lastPostDate: string | null;
  qaCount: number;
  unansweredQa: number;
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
}

export interface GbpQaItem {
  question: string;
  answerCount: number;
  topAnswer?: string;
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
  qaItems?: GbpQaItem[];
  googleSuggestions?: GbpGoogleSuggestion[];
  hasGoogleUpdated?: boolean;
}

export interface GeoRankPoint {
  distanceMiles: number;
  rank: number | null;
  inLocalPack: boolean;
}

/** Spatial rank sample at a grid point around the business (geo heatmap). */
export interface GeoGridPoint {
  lat: number;
  lng: number;
  offsetNorthMiles: number;
  offsetEastMiles: number;
  rank: number | null;
  inLocalPack: boolean;
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
}

export interface CitationCheck {
  source: string;
  nameMatch: boolean;
  addressMatch: boolean;
  phoneMatch: boolean;
  url?: string;
}

export interface WebsiteSignals {
  napMatch: boolean;
  hasLocalBusinessSchema: boolean;
  hasLocalLandingPage: boolean;
  issues: string[];
}

export interface OffGoogleSnapshot {
  collectedAt: string;
  citations: CitationCheck[];
  citationConsistencyScore: number;
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
  position: number | "not_in_pack";
  positionLabel: string;
  inLocalPack: boolean;
  impressions: number | null;
  impressionsLabel: string;
  estimatedMonthlyRevenue: number | null;
  potentialAtRank1: number | null;
  scoreImpactIfRank1: number;
  suggestedAction: string;
}

export interface PathToHealthyStep {
  id: string;
  title: string;
  scoreImpact: number;
  source: "gap" | "plan";
  priority?: string;
  order: number;
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
  | "create_post"
  | "manual";

export interface GbpPlanActionData {
  primaryCategory?: string;
  secondaryCategories?: string[];
  description?: string;
  postSummary?: string;
  websiteUri?: string;
  serviceName?: string;
  serviceDescription?: string;
  sourceUrl?: string;
  mediaCategory?: string;
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
  | "gbp_attributes"
  | "gbp_website"
  | "gbp_phone"
  | "gbp_hours"
  | "gbp_accept_suggestion"
  | "gbp_checklist"
  | "review_response"
  | "review_delete_reply"
  | "review_request"
  | "qa_answer"
  | "schema_markup"
  | "citation_fix"
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
