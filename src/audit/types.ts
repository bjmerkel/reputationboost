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
  website?: string;
  phone?: string;
  gbpConnection?: GbpConnection;
  onboardingComplete?: boolean;
}

export interface GbpConnection {
  businessId: string;
  accountId: string;
  locationId: string;
  placeId?: string;
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
}

export interface GbpCompleteness {
  hasHours: boolean;
  hasHolidayHours: boolean;
  hasDescription: boolean;
  descriptionLength: number;
  hasServices: boolean;
  serviceCount: number;
  attributeCount: number;
  completenessScore: number;
}

export interface GbpContent {
  photoCount: number;
  photosByType: Record<string, number>;
  lastPhotoUpload: string | null;
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
  periodDays: number;
}

export interface GbpIssues {
  isSuspended: boolean;
  isVerified: boolean;
  hasDuplicateListings: boolean;
  napInconsistencies: string[];
}

export interface GbpSnapshot {
  collectedAt: string;
  identity: GbpIdentity;
  completeness: GbpCompleteness;
  content: GbpContent;
  engagement: GbpEngagement;
  performance: GbpPerformance;
  issues: GbpIssues;
}

export interface GeoRankPoint {
  distanceMiles: number;
  rank: number | null;
  inLocalPack: boolean;
}

export interface KeywordRankSnapshot {
  keyword: string;
  localPackPosition: LocalPackPosition | number;
  inLocalPack: boolean;
  geoRanks: GeoRankPoint[];
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

export interface ReviewRecord {
  id: string;
  rating: number;
  text: string;
  author: string;
  publishedAt: string;
  responded: boolean;
  responseTimeHours: number | null;
  sentiment: "positive" | "neutral" | "negative";
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
}

export interface AuditRunResult {
  success: boolean;
  audit: FullAuditPayload;
  storagePath: string;
}

// ─── Phase 2: Scoring & Strategy ───────────────────────────────────────────

export type HealthGrade = "healthy" | "at_risk" | "urgent";
export type ActionPriority = "P0" | "P1" | "P2" | "P3";
export type ActionCategory =
  | "gbp_profile"
  | "content"
  | "reviews"
  | "rankings"
  | "social"
  | "disputes"
  | "technical";

export interface HealthScores {
  overall: number;
  grade: HealthGrade;
  gbpCompleteness: number;
  localPackCoverage: number;
  reviewStrength: number;
  engagement: number;
  competitiveGap: number;
}

export interface GapFlag {
  id: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  description: string;
  impact: number;
  effort: number;
  impactScore: number;
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
  improvedKeywords: string[];
  declinedKeywords: string[];
  rankMovements: RankMovement[];
  competitorDeltas: CompetitorDelta[];
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
  | "create_post"
  | "manual";

export interface GbpPlanActionData {
  primaryCategory?: string;
  secondaryCategories?: string[];
  description?: string;
  postSummary?: string;
}

export interface GbpPlanStep {
  stepNumber: number;
  title: string;
  instruction: string;
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

export interface GbpOptimizationPlan {
  title: string;
  businessName: string;
  address: string;
  objective: string;
  targetKeywords: string[];
  steps: GbpPlanStep[];
  keywordPriority: GbpKeywordPriority[];
  weeklyCadence: string[];
  monthlyCadence: string[];
  contentSource?: "llm" | "template";
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
  | "gbp_services"
  | "review_response"
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
}

export interface Phase3ExecutionReport {
  generatedAt: string;
  tasksCreated: number;
  pendingApproval: number;
  autoApproved: number;
  tasks: ExecutionTask[];
  contentSource?: "llm" | "template";
}
