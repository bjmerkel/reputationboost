import type { FullAuditPayload } from "@/audit/types";
import { resolveDisplayCategory } from "@/lib/business/display-category";

export type AcvUnitKind = "job" | "visit" | "sale" | "order" | "case" | "customer";

export interface AcvCopy {
  kind: AcvUnitKind;
  fieldLabel: string;
  shortLabel: string;
  planNudgeTitle: string;
  planNudgeBody: string;
  addAction: string;
  settingsLink: string;
  settingsPrompt: string;
  saveButton: string;
  perUnit: string;
  perConvertedUnit: string;
  playbookTitle: string;
  roiPrompt: string;
  roiSettingsLink: string;
}

const COPY_BY_KIND: Record<
  AcvUnitKind,
  Omit<AcvCopy, "kind">
> = {
  job: {
    fieldLabel: "Average job value",
    shortLabel: "average job value",
    planNudgeTitle: "Add your average job value to turn leads into $/mo",
    planNudgeBody: "Set average job value to convert those into dollar estimates.",
    addAction: "Add average job value →",
    settingsLink: "Set average job value in Settings →",
    settingsPrompt: "Add your average job value in Settings to see revenue estimates.",
    saveButton: "Save job value",
    perUnit: "per job",
    perConvertedUnit: "per completed job",
    playbookTitle: "Set your average job value",
    roiPrompt: "Add your average job value to see dollar estimates for your actions.",
    roiSettingsLink: "Set job value in Settings →",
  },
  visit: {
    fieldLabel: "Average visit value",
    shortLabel: "average visit value",
    planNudgeTitle: "Add your average visit value to turn leads into $/mo",
    planNudgeBody: "Set average visit value to convert those into dollar estimates.",
    addAction: "Add average visit value →",
    settingsLink: "Set average visit value in Settings →",
    settingsPrompt: "Add your average visit value in Settings to see revenue estimates.",
    saveButton: "Save visit value",
    perUnit: "per visit",
    perConvertedUnit: "per visit",
    playbookTitle: "Set your average visit value",
    roiPrompt: "Add your average visit value to see dollar estimates for your actions.",
    roiSettingsLink: "Set visit value in Settings →",
  },
  sale: {
    fieldLabel: "Average sale value",
    shortLabel: "average sale value",
    planNudgeTitle: "Add your average sale value to turn leads into $/mo",
    planNudgeBody: "Set average sale value to convert those into dollar estimates.",
    addAction: "Add average sale value →",
    settingsLink: "Set average sale value in Settings →",
    settingsPrompt: "Add your average sale value in Settings to see revenue estimates.",
    saveButton: "Save sale value",
    perUnit: "per sale",
    perConvertedUnit: "per sale",
    playbookTitle: "Set your average sale value",
    roiPrompt: "Add your average sale value to see dollar estimates for your actions.",
    roiSettingsLink: "Set sale value in Settings →",
  },
  order: {
    fieldLabel: "Average order value",
    shortLabel: "average order value",
    planNudgeTitle: "Add your average order value to turn leads into $/mo",
    planNudgeBody: "Set average order value to convert those into dollar estimates.",
    addAction: "Add average order value →",
    settingsLink: "Set average order value in Settings →",
    settingsPrompt: "Add your average order value in Settings to see revenue estimates.",
    saveButton: "Save order value",
    perUnit: "per order",
    perConvertedUnit: "per order",
    playbookTitle: "Set your average order value",
    roiPrompt: "Add your average order value to see dollar estimates for your actions.",
    roiSettingsLink: "Set order value in Settings →",
  },
  case: {
    fieldLabel: "Average case value",
    shortLabel: "average case value",
    planNudgeTitle: "Add your average case value to turn leads into $/mo",
    planNudgeBody: "Set average case value to convert those into dollar estimates.",
    addAction: "Add average case value →",
    settingsLink: "Set average case value in Settings →",
    settingsPrompt: "Add your average case value in Settings to see revenue estimates.",
    saveButton: "Save case value",
    perUnit: "per case",
    perConvertedUnit: "per case",
    playbookTitle: "Set your average case value",
    roiPrompt: "Add your average case value to see dollar estimates for your actions.",
    roiSettingsLink: "Set case value in Settings →",
  },
  customer: {
    fieldLabel: "Average customer value",
    shortLabel: "average customer value",
    planNudgeTitle: "Add your average customer value to turn leads into $/mo",
    planNudgeBody: "Set average customer value to convert those into dollar estimates.",
    addAction: "Add average customer value →",
    settingsLink: "Set average customer value in Settings →",
    settingsPrompt: "Add your average customer value in Settings to see revenue estimates.",
    saveButton: "Save customer value",
    perUnit: "per customer",
    perConvertedUnit: "per converted customer",
    playbookTitle: "Set your average customer value",
    roiPrompt: "Add your average customer value to see dollar estimates for your actions.",
    roiSettingsLink: "Set customer value in Settings →",
  },
};

export function resolveAcvUnitKind(category?: string | null): AcvUnitKind {
  const c = (category ?? "").toLowerCase();
  if (!c.trim()) return "customer";

  if (/dealer|auto sales|car lot|used car|automotive sales/.test(c)) return "sale";
  if (/groom|salon|spa|barber|nail|massage|kennel|pet groom|dog groom|cat groom/.test(c)) {
    return "visit";
  }
  if (/vet|veterinar|animal hospital|pet care/.test(c)) return "visit";
  if (/restaurant|cafe|bakery|pizza|bar\b|food|diner|bistro|coffee|catering/.test(c)) {
    return "order";
  }
  if (
    /plumb|hvac|electric|roof|contractor|repair|mechanic|landscap|handyman|pest|remodel|paint|flooring|window|garage door|appliance|septic|pool service|tree service|junk removal|moving company/.test(
      c
    )
  ) {
    return "job";
  }
  if (/dentist|doctor|clinic|chiropr|physio|therapy|medical|optomet|dermatolog|orthodont/.test(c)) {
    return "visit";
  }
  if (/lawyer|attorney|legal|law firm/.test(c)) return "case";
  if (/retail|store|shop|boutique|furniture|jewelry|jeweller|showroom/.test(c)) return "sale";

  return "customer";
}

export function resolveAcvCopy(category?: string | null): AcvCopy {
  const kind = resolveAcvUnitKind(category);
  return { kind, ...COPY_BY_KIND[kind] };
}

export function resolveAcvCopyFromAudit(
  audit: FullAuditPayload,
  industry?: string | null
): AcvCopy {
  return resolveAcvCopy(resolveDisplayCategory(audit, industry));
}

export function acvEstimateRationale(
  copy: AcvCopy,
  category: string,
  locationLabel: string,
  amount: number
): string {
  const label = category.trim() || "local business";
  const noun =
    copy.kind === "job"
      ? "jobs"
      : copy.kind === "visit"
        ? "visits"
        : copy.kind === "sale"
          ? "sales"
          : copy.kind === "order"
            ? "orders"
            : copy.kind === "case"
              ? "cases"
              : "customers";

  return `Typical ${label} ${noun}${locationLabel} often run around $${amount}.`;
}
