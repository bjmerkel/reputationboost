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
