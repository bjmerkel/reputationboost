import type { FullAuditPayload } from "@/audit/types";
import type { GbpMediaCategory } from "@/lib/google/gbp-media";

export interface GbpVideoJob {
  title: string;
  category: GbpMediaCategory;
  hint: string;
  durationHint: string;
}

function cityFromAudit(audit: FullAuditPayload): string {
  return audit.gbp.identity.address.split(",").slice(-2, -1)[0]?.trim() ?? "your area";
}

/** Fallback video jobs when the profile has no GBP videos. */
export function buildTemplateVideoJobs(audit: FullAuditPayload): GbpVideoJob[] {
  const city = cityFromAudit(audit);
  const coverage = audit.gbp.content.mediaCoverage;
  if (coverage?.hasVideo) return [];

  const businessName = audit.gbp.identity.name || audit.clientName;
  const keywords = audit.rankings.keywords.slice(0, 2);

  const jobs: GbpVideoJob[] = [
    {
      title: "Business walkthrough video",
      category: "AT_WORK",
      hint: `30–60 second walkthrough of ${businessName} in ${city}. Show your team, workspace, or service delivery.`,
      durationHint: "30–60 seconds",
    },
  ];

  for (const kw of keywords) {
    jobs.push({
      title: `Service video: ${kw.keyword}`,
      category: "AT_WORK",
      hint: `Short clip featuring "${kw.keyword}" for ${city} customers. Keep it under 60 seconds.`,
      durationHint: "30–60 seconds",
    });
  }

  return jobs.slice(0, 3);
}

export function videoJobDraftContent(job: GbpVideoJob): string {
  return [
    "Upload your video file in the Videos tab, or paste a public video URL (https://…).",
    "",
    job.hint,
    `Category: ${job.category}`,
    `Length: ${job.durationHint}`,
  ].join("\n");
}
