export { computeAttributionForTask, computeAttributionAfterTaskCompletion, recomputeAttributionsForBusiness } from "./compute";
export {
  enrichTaskWithProjectionSnapshot,
  resolveProjectionsFromTask,
  snapshotTaskProjections,
} from "./projection-snapshot";
export { matchKeywordsInText, resolveTargetKeywords } from "./keywords";
export { buildAttributionNarrative } from "./narrative";
export { estimateAttributionRevenue, formatCurrency, buildRoiHeadline, DEFAULT_ROI_CONFIG } from "./roi";
