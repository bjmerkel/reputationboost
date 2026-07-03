import type { AuditView } from "@/components/audit/types";

export interface PlaceCardTab {
  id: AuditView;
  label: string;
  mapsLabel: string;
  shortLabel: string;
}

/** Maps-native tab labels mapped to existing audit views (?view= stays compatible). */
export const PLACE_CARD_TABS: PlaceCardTab[] = [
  { id: "report", label: "Overview", mapsLabel: "Overview", shortLabel: "Overview" },
  { id: "reviews", label: "Reviews", mapsLabel: "Reviews", shortLabel: "Reviews" },
  { id: "strategy", label: "Plan", mapsLabel: "Plan", shortLabel: "Plan" },
  { id: "photos", label: "Photos", mapsLabel: "Photos", shortLabel: "Photos" },
  { id: "execute", label: "Updates", mapsLabel: "Updates", shortLabel: "Updates" },
  { id: "data", label: "Insights", mapsLabel: "Insights", shortLabel: "Data" },
];
