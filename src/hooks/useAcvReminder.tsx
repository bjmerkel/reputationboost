"use client";

import { useEffect, useMemo, useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
import { parseLocationFromAddress } from "@/lib/business/acv-defaults";
import { resolveAcvCopyFromAudit } from "@/lib/business/acv-copy";
import PlanAcvReminderModal from "@/components/plan/PlanAcvReminderModal";
import type { AcvRevenuePreview } from "@/components/plan/plan-viewport";
import { shouldShowPlanAcvReminder } from "@/components/plan/plan-acv-reminder";
import { useAcvEstimate } from "@/hooks/useAcvEstimate";

export function useAcvReminder(options: {
  businessId?: string | null;
  clientId: string;
  audit: FullAuditPayload;
  avgCustomerValue?: number | null;
  currency?: string;
  businessIndustry?: string | null;
  revenuePreview?: AcvRevenuePreview | null;
  autoShow?: boolean;
}) {
  const {
    businessId,
    clientId,
    audit,
    avgCustomerValue,
    currency = "USD",
    businessIndustry,
    revenuePreview = null,
    autoShow = false,
  } = options;

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [savedAcv, setSavedAcv] = useState<number | null>(null);

  const effectiveAvgCustomerValue = savedAcv ?? avgCustomerValue ?? null;
  const acvMissing = effectiveAvgCustomerValue == null || effectiveAvgCustomerValue <= 0;
  const acvCopy = useMemo(
    () => resolveAcvCopyFromAudit(audit, businessIndustry),
    [audit, businessIndustry]
  );
  const location = useMemo(
    () => parseLocationFromAddress(audit.gbp.identity.address),
    [audit.gbp.identity.address]
  );
  const { estimate, loading: estimateLoading } = useAcvEstimate({
    enabled: acvMissing,
    businessId,
    clientId,
    businessName: audit.clientName,
    primaryCategory: audit.gbp.identity.primaryCategory,
    city: location.city,
    state: location.state,
    industry: audit.gbp.identity.primaryCategory,
  });

  useEffect(() => {
    if (!autoShow || dismissed || !businessId) return;
    if (!shouldShowPlanAcvReminder({ businessId, avgCustomerValue: effectiveAvgCustomerValue })) {
      return;
    }
    setOpen(true);
  }, [autoShow, businessId, dismissed, effectiveAvgCustomerValue]);

  function openReminder() {
    if (!businessId) return;
    setDismissed(false);
    setOpen(true);
  }

  function closeReminder() {
    setOpen(false);
    setDismissed(true);
  }

  const modal =
    businessId && acvMissing ? (
      <PlanAcvReminderModal
        open={open}
        businessId={businessId}
        currency={currency}
        estimate={estimate}
        estimateLoading={estimateLoading}
        revenuePreview={revenuePreview}
        acvCopy={acvCopy}
        onClose={closeReminder}
        onSaved={(value) => {
          setSavedAcv(value);
          setOpen(false);
        }}
      />
    ) : null;

  return {
    acvCopy,
    acvMissing,
    effectiveAvgCustomerValue,
    openReminder,
    modal,
  };
}
