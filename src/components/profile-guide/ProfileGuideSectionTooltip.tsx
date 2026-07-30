"use client";

import InfoTooltip from "@/components/ui/InfoTooltip";
import type { ProfileGuideSectionTooltip } from "@/lib/profile-guide/section-tooltips";

export default function ProfileGuideSectionTooltip({
  content,
  className,
}: {
  content: ProfileGuideSectionTooltip;
  className?: string;
}) {
  return (
    <InfoTooltip
      title={content.title}
      calculation={content.what}
      importance={content.why}
      examples={content.examples}
      calculationLabel="What it is:"
      importanceLabel="Why it matters:"
      examplesLabel="Examples:"
      className={className}
    />
  );
}
