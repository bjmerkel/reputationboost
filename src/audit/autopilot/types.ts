import type { ExecutionType } from "@/audit/types";
import type { CalibrationConfidence } from "@/audit/phase2/attribution-calibration";

export interface ClientProfileSnapshot {
  primaryCategory: string;
  secondaryCategories: string[];
  reviewCount: number;
  reviewVelocity30d: number;
  rating: number | null;
  photoCount: number;
  photoRecencyDays: number | null;
  postCadenceDays: number | null;
  postsLast30Days: number;
  services: string[];
  attributeCount: number;
  descriptionLength: number;
}

export interface LeaderDeltaDimension<T> {
  client: T;
  leader: T;
  gap: number | null;
  leaderAhead: boolean;
}

export interface LeaderDeltaAction {
  actionType: ExecutionType;
  planStepNumber: number;
  hypothesis: string;
  marketPriorRankDelta: number;
  confidence: CalibrationConfidence;
  effort: number;
}

export interface LeaderDelta {
  keyword: string;
  gridNorth: number;
  gridEast: number;
  leaderPlaceId: string;
  leaderName: string;
  clientRank: number | null;
  dimensions: {
    primaryCategory: LeaderDeltaDimension<string> & { match: boolean };
    secondaryCategories: {
      client: string[];
      leader: string[];
      missing: string[];
      extra: string[];
      leaderAhead: boolean;
    };
    reviewCount: LeaderDeltaDimension<number>;
    reviewVelocity30d: LeaderDeltaDimension<number>;
    rating: LeaderDeltaDimension<number | null>;
    photoCount: LeaderDeltaDimension<number>;
    photoRecencyDays: LeaderDeltaDimension<number | null>;
    postCadenceDays: LeaderDeltaDimension<number | null>;
    servicesListed: {
      client: string[];
      leader: string[];
      missing: string[];
      leaderAhead: boolean;
    };
    attributeCount: LeaderDeltaDimension<number>;
    descriptionLength: LeaderDeltaDimension<number>;
  };
  rankedActions: LeaderDeltaAction[];
}

export interface LosingCell {
  gridNorth: number;
  gridEast: number;
  rank: number | null;
  leaderPlaceId: string;
  leaderName: string;
  priority: number;
}

export type RankingExperimentStatus =
  | "proposed"
  | "pending_approval"
  | "running"
  | "measuring"
  | "won"
  | "lost"
  | "inconclusive"
  | "cancelled";

export type ConcludedRankingExperimentStatus = Extract<
  RankingExperimentStatus,
  "won" | "lost" | "inconclusive"
>;

export type ConcludedRankingExperiment = Omit<RankingExperiment, "status"> & {
  status: ConcludedRankingExperimentStatus;
};

export interface BanditMetadata {
  selectedIndex: number;
  ucbScore: number;
  explorationReason: string;
  alternatives: Array<{
    actionType: ExecutionType;
    planStepNumber: number;
    score: number;
    rank: number;
    ucbBonus?: number;
    meanReward?: number;
  }>;
}

export interface RankingExperiment {
  id: string;
  businessId: string;
  userId: string;
  auditId: string;
  keyword: string;
  gridNorth: number;
  gridEast: number;
  leaderPlaceId: string;
  leaderName: string;
  actionType: ExecutionType;
  planStepNumber: number | null;
  hypothesis: string;
  leaderDelta: LeaderDelta;
  marketKey: string;
  origin: import("./modes").ExperimentOrigin;
  banditMetadata: BanditMetadata | null;
  status: RankingExperimentStatus;
  executionTaskId: string | null;
  baselineSnapshotDate: string;
  targetRankBefore: number | null;
  targetRankAfter: number | null;
  targetCellImproved: boolean | null;
  attributionWindowDays: number;
  startedAt: string | null;
  concludedAt: string | null;
  conclusionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
