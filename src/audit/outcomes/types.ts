export interface ProvenWin {
  taskType: string;
  title: string;
  primaryKeyword: string | null;
  rankBefore: number | null;
  rankAfter: number | null;
  callsDelta: number;
  directionsDelta: number;
  estimatedRevenue: number | null;
  narrative: string;
}

export interface IneffectiveAction {
  taskType: string;
  title: string;
  primaryKeyword: string | null;
  callsDelta: number;
  rankDelta: number | null;
}

export interface OutcomesContext {
  provenWins: ProvenWin[];
  whatDidntWork: IneffectiveAction[];
  correlations: string[];
  monthlyEstimatedRevenue: number | null;
  tasksCompleted: number;
  tasksSkipped: number;
  priorKpiTargets: string[];
  completedTaskTypes: Record<string, number>;
  topPerformingKeywords: string[];
}
