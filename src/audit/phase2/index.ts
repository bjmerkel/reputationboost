export { computeHealthScores, computeVisibilityScore, computeConversionScore, computeRevenueCaptureScore, computeKeywordRelevanceScore, positionVisibilityScore, positionClickShare, resolveKeywordPosition, resolveKeywordPositionAtRadius, keywordImpressionWeight, impressionWeightFloor, matchSearchKeywordImpressions, keywordGeoGridVisibilityScore, keywordGridCoverageScore, keywordRadiusVisibilityScore, keywordServiceAreaVisibilityScore, keywordServiceAreaRevenueCaptureScore, detectPackFragility, resolveClickSharePercent } from "./scoring";
export {
  GRID_RADIUS_BLEND,
  RADIUS_PROFILE_WEIGHTS,
  formatRadiusMiles,
  radiusProfileLabel,
  radiusWeightsForAudit,
  resolveRadiusProfile,
  availableSearchRadii,
} from "./radius-profiles";
export type { RadiusProfileKey, RadiusWeights } from "./radius-profiles";
export { extractKeywordRelevanceHeuristic, resolveKeywordRelevance, relevanceByKeyword } from "./relevance-heuristic";
export { DEFAULT_RANK_MEDIAN_WINDOW_DAYS, medianOf, medianRankSnapshotForKeyword, smoothRankSnapshotsForDate, isCenterSnapshot } from "./rank-median";
export type { SmoothRankSnapshotOptions } from "./rank-median";
export { compareRanksAtOneMile, summarizeRankValidation, compareSearchModesAtOneMile, validateKeywordRanks } from "./rank-validation";
export { DEFAULT_BACKTEST_HORIZON_DAYS, buildBacktestSamples, evaluateBacktestMetrics } from "./score-backtest";
export {
  DEFAULT_BLEND_WEIGHTS,
  DEFAULT_CLICK_SHARE_CURVE,
  DEFAULT_LEARNED_SCORE_MODEL,
  buildLearnedScoreModel,
  learnClickShareCurve,
  learnBlendWeights,
  effectiveScoreModel,
  topClickSharePercent,
} from "./score-learning";
export {
  DRIVER_OUTCOME_BLEND,
  OUTCOME_INDEX_WEIGHTS,
  computeOutcomeIndex,
  computeOverallFromDriverOutcome,
} from "./score-driver-outcome";
export { computeKeywordScores } from "./keyword-scores";
export {
  applyKeywordPortfolioToClient,
  buildOptimizedKeywordList,
  computeKeywordPortfolio,
  findTrackedKeywordForGbpTerm,
  isBrandKeyword,
  prioritizeKeywordsForGrid,
} from "./keyword-portfolio";
export {
  BALANCED_WEIGHTS_WITH_ACV,
  BALANCED_WEIGHTS_WITHOUT_ACV,
  compositeMarginalScore,
  marginalScoreForMode,
  normalizeMarginalGain,
  resolveBlendWeights,
  resolvePathOptimizationMode,
} from "./path-optimization";
export type { PathOptimizationBlendWeights } from "../types";
export { buildPathToHealthy } from "./path-to-healthy";
export {
  buildKeywordFromRadiusMedians,
  buildServiceAreaRankMovements,
  keywordMapFromRankSnapshots,
  medianRanksByRadius,
  serviceAreaImproved,
  serviceAreaVisibilityDelta,
  weakestRadiusImproved,
} from "./service-area-attribution";
export {
  buildAttributionCalibration,
  buildGapAttributionCalibration,
  calibratedRevenueGain,
  calibratedStepImpact,
  mergeCalibrations,
  projectionRevenueScaleForStep,
  projectionScaleForStep,
  rankDeltaForGap,
  resolveCalibrationConfidence,
} from "./attribution-calibration";
export { applyRankSnapshotsToAudit, applyGridSnapshotsToAudit, computeScoreDailySnapshot } from "./score-snapshot";
export { buildScoreChangelogFromSnapshots, buildScoreChangelogFromHealthScores, buildRankMovementsFromSnapshots, buildRankMovementsForChangelog } from "./score-changelog";
export { ingestScoreDailyForBusiness } from "./score-ingest";
export { detectGaps } from "./gaps";
export { buildPlanStepCandidates, summarizePlanCandidates } from "./plan-candidates";
export type { PlanStepCandidate } from "./plan-candidates";
export {
  estimateStepHealthImpact,
  estimateStepOutcomeImpact,
  estimateStepRevenueImpact,
  gapCandidateSortScore,
  gapDriverScoreImpact,
  gapOutcomeScoreImpact,
  gapQualifiesForPool,
  gapRevenueImpact,
  gapScoreImpact,
  gapScoreComponent,
} from "./score-impact";
export {
  applyGapMutation,
  applyOutcomeGapMutation,
  applyOutcomeMutation,
  applyStepMutation,
  cloneAudit,
  isStepSatisfied,
  keywordNeedsOutcomeWork,
  pickActionsForDriverTarget,
  pickActionsForTarget,
  estimateTotalMonthlyRevenue,
  improveKeywordRankForFragility,
  projectHealthScoresFromActions,
  projectHealthScoresFromStepNumbers,
  projectKeywordToRank1,
  projectOutcomeScoresFromActions,
  simulateActionMarginalImpact,
  simulateGapDriverImpact,
  simulateStepDriverImpact,
} from "./counterfactual";
export {
  buildProjectionAccuracySamples,
  buildOutcomeProjectionAccuracySamples,
  buildRevenueProjectionAccuracySamples,
  computeObservedDriverImpact,
  computeObservedOutcomeImpact,
  medianDriverScoreInRange,
  medianOutcomeIndexInRange,
  summarizeProjectionAccuracy,
} from "./projection-accuracy";
export { computeMonthOverMonth } from "./diff";
export { buildStrategy } from "./strategy";
export { buildMonthlyReport, buildFirstAuditReport, describeRankMovement, describeCompetitorDelta } from "./monthly-report";
