"use client";

import PlatformDemo from "@/components/marketing/PlatformDemo";
import SectionHeader from "@/components/marketing/SectionHeader";
import { usePreviewAudit } from "@/context/PreviewAuditContext";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

export default function PlatformExplorer() {
  const {
    platformAudit,
    businessName,
    industry,
    location,
    isLive,
    loading,
    preview,
  } = usePreviewAudit();

  return (
    <section id="platform-explorer" className="border-b border-[#dadce0] bg-[#f8f9fa] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          label="Explore the Platform"
          labelColor="cyan"
          title={
            <>
              This is the real product —{" "}
              <span className="gradient-text font-semibold">not a mockup</span>
            </>
          }
          subtitle={
            isLive
              ? `Interactive preview for ${businessName}. Click through Home, Plan, Reviews, and Results — pan the map, toggle keywords, and see what customers see on Google.`
              : "Search your business above to load your live data, or explore the demo below. Click through tabs, pan the geo-grid map, and open View as Customer."
          }
        />

        {loading && (
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-[#1a73e8]">
            Building your platform preview…
          </p>
        )}

        {!loading && preview && (
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-[#188038]">
            Score {preview.score.overall}/100 · {preview.keywords.length} keywords tracked · data
            from Google Maps
          </p>
        )}

        <div className="mt-10 lg:mt-12">
          <PlatformDemo
            audit={platformAudit}
            businessName={businessName}
            industry={industry}
            location={location}
            isLive={isLive}
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={SIGNUP_URL}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-white"
          >
            {SIGNUP_CTA_LABEL}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <a href="#how-it-works" className="btn-secondary rounded-full px-8 py-3 text-sm font-medium">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
