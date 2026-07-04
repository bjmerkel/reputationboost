"use client";

import PlatformDemo from "@/components/marketing/PlatformDemo";
import PlatformLoading from "@/components/marketing/PlatformLoading";
import PlatformWelcome from "@/components/marketing/PlatformWelcome";
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
    <section id="platform-explorer" className="scroll-mt-16 bg-[#e8eaed]">
      {loading && <PlatformLoading />}

      {!loading && isLive && preview && (
        <>
          <PlatformDemo
            audit={platformAudit}
            businessName={businessName}
            industry={industry}
            location={location}
            isLive
          />
          <div className="border-t border-[#dadce0] bg-white px-4 py-4">
            <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-center text-sm text-[#5f6368] sm:text-left">
                Score <span className="font-semibold text-[#202124]">{preview.score.overall}/100</span>
                {" · "}
                {preview.keywords.length} keywords tracked
                {" · "}
                {preview.pathToHealthy.topActions.length} actions ready
              </p>
              <a
                href={SIGNUP_URL}
                className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white"
              >
                {SIGNUP_CTA_LABEL}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
          </div>
        </>
      )}

      {!loading && !isLive && <PlatformWelcome />}
    </section>
  );
}
