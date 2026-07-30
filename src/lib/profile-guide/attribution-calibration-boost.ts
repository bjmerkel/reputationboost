import type {
  AttributionCalibration,
  StepCalibration,
} from "@/audit/phase2/attribution-calibration";
import { resolveCalibrationConfidence } from "@/audit/phase2/attribution-calibration";
import type { ProfileGuideReadiness } from "./readiness";

const REVIEW_REQUEST_PLAN_STEP = 10;
const PROFILE_GUIDE_ATTRIBUTION_BOOST_THRESHOLD = 2;

function defaultReviewStepCalibration(sampleSize: number): StepCalibration {
  return {
    sampleSize,
    medianRankDelta: null,
    medianCallsDelta: 0,
    medianDirectionsDelta: 0,
    medianWebsiteClicksDelta: 0,
    estimatedScoreImpact: 2,
    projectionSampleSize: 0,
    medianProjectedDriverImpact: null,
    medianObservedDriverImpact: null,
    medianObservedOutcomeImpact: null,
    medianObservedRevenueGain: null,
    medianProjectedRevenueGain: null,
    revenueProjectionSampleSize: 0,
    revenueProjectionScale: 1,
    confidence: resolveCalibrationConfidence(sampleSize),
  };
}

/**
 * When Profile Guide is driving attributed reviews, boost step 10 calibration so
 * review-request impact ranks higher in NBA and keyword playbooks.
 */
export function applyProfileGuideReviewCalibrationBoost(
  calibration: AttributionCalibration | undefined,
  readiness: ProfileGuideReadiness
): AttributionCalibration | undefined {
  if (!calibration || readiness.attributedReviews30d < PROFILE_GUIDE_ATTRIBUTION_BOOST_THRESHOLD) {
    return calibration;
  }

  const existing = calibration[REVIEW_REQUEST_PLAN_STEP];
  const boosted: StepCalibration = existing
    ? { ...existing }
    : defaultReviewStepCalibration(readiness.attributedReviews30d);

  boosted.sampleSize = Math.max(boosted.sampleSize, readiness.attributedReviews30d);
  boosted.estimatedScoreImpact = Math.max(boosted.estimatedScoreImpact, 3);
  boosted.medianObservedOutcomeImpact =
    boosted.medianObservedOutcomeImpact != null
      ? Math.min(15, boosted.medianObservedOutcomeImpact + 2)
      : 3;
  boosted.confidence = resolveCalibrationConfidence(boosted.sampleSize);

  return { ...calibration, [REVIEW_REQUEST_PLAN_STEP]: boosted };
}
