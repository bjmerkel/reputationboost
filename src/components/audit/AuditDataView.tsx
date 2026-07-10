"use client";

import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import AuditDataPanel from "@/components/audit/AuditDataPanel";

export default function AuditDataView({
  audit,
  clientId,
  tasks,
  attributions,
  activeKeyword,
  onKeywordChange,
  gbpConnected = false,
  onNavigateToPlan,
  onKeywordsUpdated,
  globalCalibration = {},
  layout = "canvas",
}: {
  audit: FullAuditPayload;
  clientId: string;
  tasks: ExecutionTask[];
  attributions: ActionAttribution[];
  activeKeyword: string;
  onKeywordChange: (keyword: string) => void;
  gbpConnected?: boolean;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: "google-updates") => void;
  onKeywordsUpdated?: (keywords: string[]) => void;
  globalCalibration?: AttributionCalibration;
  layout?: "sidebar" | "canvas";
}) {
  return (
    <AuditDataPanel
      audit={audit}
      clientId={clientId}
      tasks={tasks}
      activeKeyword={activeKeyword}
      onKeywordChange={onKeywordChange}
      variant="light"
      layout={layout}
      gbpConnected={gbpConnected}
      onNavigateToPlan={onNavigateToPlan}
      onKeywordsUpdated={onKeywordsUpdated}
      attributions={attributions}
      globalCalibration={globalCalibration}
    />
  );
}
