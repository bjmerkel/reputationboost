import type { HealthGrade } from "@/audit/types";

export type AdminRole = "viewer" | "operator" | "superadmin";

export type UserStatus = "active" | "at_risk" | "churning" | "never_onboarded" | "signed_up";

export interface AdminOverview {
  totalUsers: number;
  activeBusinesses: number;
  avgScore: number | null;
  gradeDistribution: Record<HealthGrade, number>;
  pendingTasks: number;
  completedTasks7d: number;
  scoreMoversUp: number;
  scoreMoversDown: number;
  staleAccounts: number;
  lastIngest: {
    status: string;
    completedAt: string | null;
    businessesProcessed: number;
    errorCount: number;
  } | null;
  signups30d: number;
}

export interface AdminUserBusinessPreview {
  id: string;
  name: string;
  location: string;
  score: number | null;
  gbpConnected: boolean;
  onboardingComplete: boolean;
}

export interface AdminUserSummary {
  userId: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  businessCount: number;
  onboardedCount: number;
  gbpConnectedCount: number;
  businesses: AdminUserBusinessPreview[];
  avgScore: number | null;
  grade: HealthGrade | null;
  scoreDelta7d: number | null;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  lastAuditAt: string | null;
  lastActivityAt: string | null;
  status: UserStatus;
  dominantAutopilotMode: string | null;
}

export interface AdminUserDetail extends AdminUserSummary {
  businesses: AdminBusinessSummary[];
  recentTasks: AdminTaskSummary[];
}

export interface AdminBusinessSummary {
  id: string;
  slug: string;
  name: string;
  industry: string;
  location: string;
  onboardingComplete: boolean;
  gbpConnected: boolean;
  autopilotMode: string;
  score: number | null;
  grade: HealthGrade | null;
  scoreDate: string | null;
  pendingTasks: number;
  completedTasks: number;
  lastAuditAt: string | null;
}

export interface AdminTaskSummary {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  taskType: string;
  priority: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminTaskListItem extends AdminTaskSummary {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  result: string | null;
}

export interface AdminTaskListResult {
  tasks: AdminTaskListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminNoteRecord {
  id: string;
  userId: string;
  authorId: string | null;
  authorEmail: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBusinessDetail extends AdminBusinessSummary {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  website: string | null;
  phone: string | null;
  failedTasks: number;
  keywordsInPack: number | null;
  totalKeywords: number | null;
  auditScore: number | null;
  auditGrade: HealthGrade | null;
  visibility: number | null;
  conversion: number | null;
  revenueCapture: number | null;
  scoreSeries: import("@/audit/types/timeseries").ScoreDailySnapshot[];
  recentTasks: AdminTaskSummary[];
}
