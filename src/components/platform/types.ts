import type { AuditView } from "@/components/audit/types";

export interface PlaceCardTab {
  id: AuditView;
  label: string;
  mapsLabel: string;
  shortLabel: string;
}

/** Four-tab navigation: Home, Plan, Results, Audit Data */
export const PLACE_CARD_TABS: PlaceCardTab[] = [
  { id: "report", label: "Home", mapsLabel: "Home", shortLabel: "Home" },
  { id: "strategy", label: "Plan", mapsLabel: "Plan", shortLabel: "Plan" },
  { id: "data", label: "Results", mapsLabel: "Results", shortLabel: "Results" },
  { id: "audit", label: "Audit Data", mapsLabel: "Audit Data", shortLabel: "Data" },
];
