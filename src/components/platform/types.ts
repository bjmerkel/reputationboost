import type { AuditView } from "@/components/audit/types";

export interface PlaceCardTab {
  id: AuditView;
  label: string;
  mapsLabel: string;
}

/** Maps-native tab labels mapped to existing audit views (?view= stays compatible). */
export const PLACE_CARD_TABS: PlaceCardTab[] = [
  { id: "report", label: "Overview", mapsLabel: "Overview" },
  { id: "strategy", label: "Plan", mapsLabel: "Plan" },
  { id: "photos", label: "Photos", mapsLabel: "Photos" },
  { id: "execute", label: "Updates", mapsLabel: "Updates" },
  { id: "data", label: "Insights", mapsLabel: "Insights" },
];
