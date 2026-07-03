import type { AuditView } from "@/components/audit/types";

export interface PlaceCardTab {
  id: AuditView;
  label: string;
  mapsLabel: string;
  shortLabel: string;
}

/** Four-tab navigation: Home, Plan, Reviews, Results */
export const PLACE_CARD_TABS: PlaceCardTab[] = [
  { id: "report", label: "Home", mapsLabel: "Home", shortLabel: "Home" },
  { id: "strategy", label: "Plan", mapsLabel: "Plan", shortLabel: "Plan" },
  { id: "reviews", label: "Reviews", mapsLabel: "Reviews", shortLabel: "Reviews" },
  { id: "data", label: "Results", mapsLabel: "Results", shortLabel: "Results" },
];
