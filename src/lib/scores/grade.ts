import type { HealthGrade } from "@/audit/types";

export function gradeFromScore(overall: number): HealthGrade {
  if (overall >= 70) return "healthy";
  if (overall >= 40) return "at_risk";
  return "urgent";
}

export function gradeLabel(grade: HealthGrade): string {
  if (grade === "healthy") return "Healthy";
  if (grade === "at_risk") return "At risk";
  return "Urgent";
}
