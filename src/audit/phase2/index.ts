export { computeHealthScores, computeVisibilityScore, computeConversionScore, computeRevenueCaptureScore, computeKeywordRelevanceScore, positionVisibilityScore, positionClickShare, resolveKeywordPosition, keywordImpressionWeight, impressionWeightFloor, matchSearchKeywordImpressions, keywordGeoGridVisibilityScore, resolveClickSharePercent } from "./scoring";
export { extractKeywordRelevanceHeuristic, resolveKeywordRelevance, relevanceByKeyword } from "./relevance-heuristic";
export { DEFAULT_RANK_MEDIAN_WINDOW_DAYS, medianOf, medianRankSnapshotForKeyword, smoothRankSnapshotsForDate } from "./rank-median";
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
  buildAttributionCalibration,
  calibratedStepImpact,
  mergeCalibrations,
  projectionScaleForStep,
} from "./attribution-calibration";
export { applyRankSnapshotsToAudit, computeScoreDailySnapshot } from "./score-snapshot";
export { buildScoreChangelogFromSnapshots, buildScoreChangelogFromHealthScores, buildRankMovementsFromSnapshots } from "./score-changelog";
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
  pickActionsForDriverTarget,
  pickActionsForTarget,
  estimateTotalMonthlyRevenue,
  projectHealthScoresFromActions,
  projectHealthScoresFromStepNumbers,
  projectOutcomeScoresFromActions,
  simulateActionMarginalImpact,
  simulateGapDriverImpact,
  simulateStepDriverImpact,
} from "./counterfactual";
export {
  buildProjectionAccuracySamples,
  computeObservedDriverImpact,
  medianDriverScoreInRange,
  summarizeProjectionAccuracy,
} from "./projection-accuracy";
export { computeMonthOverMonth } from "./diff";
export { buildStrategy } from "./strategy";
export { buildMonthlyReport, buildFirstAuditReport, describeRankMovement, describeCompetitorDelta } from "./monthly-report";
