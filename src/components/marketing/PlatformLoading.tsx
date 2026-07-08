"use client";

import RankingMap from "@/components/platform/RankingMap";
import { usePreviewAudit } from "@/context/PreviewAuditContext";

export default function PlatformLoading() {
  const { location, businessName } = usePreviewAudit();

  return (
    <div className="platform-theme google-maps-frame relative flex min-h-[520px] flex-col overflow-hidden bg-white [height:min(88dvh,900px)]">
      <div className="shrink-0 border-b border-[#d2e3fc] bg-[#e8f0fe] px-4 py-2.5 text-center text-sm text-[#1a73e8]">
        Auditing <span className="font-semibold">{businessName}</span> — pulling Google
        Maps data, AI-picking keywords, checking Local 3-Pack…
      </div>

      <div className="google-maps-shell flex min-h-0 flex-1 flex-col-reverse overflow-hidden lg:flex-row">
        <div className="flex min-h-0 flex-[11] flex-col overflow-hidden border-[#dadce0] bg-white lg:h-full lg:w-[408px] lg:flex-none lg:shrink-0 lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <div className="space-y-4 p-5">
              <div className="h-28 animate-pulse rounded-lg bg-[#e8eaed]" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-[#e8eaed]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[#e8eaed]" />
              <div className="mt-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-[#e8eaed]" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 min-w-0 flex-[9] overflow-hidden lg:h-full lg:min-h-[280px] lg:flex-1">
          <RankingMap
            lat={location.lat}
            lng={location.lng}
            address={location.address}
            businessName={businessName}
            disableGridFetch
          />
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="rounded-xl border border-[#dadce0] bg-white px-6 py-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1a73e8] border-t-transparent" />
                <p className="text-sm font-medium text-[#202124]">Building your audit…</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
