"use client";

import { useEffect } from "react";
import { trackProfileGuideEvent } from "@/lib/analytics/profile-guide-events";
import ProfileGuidePhonePreview from "@/components/profile-guide/ProfileGuidePhonePreview";

interface PublicProfileGuideClientProps {
  guideId: string;
  displayName: string;
  primaryColor: string;
  logoUrl: string | null;
  tagline: string | null;
  links: Array<{ id: string; label: string; url: string }>;
  source?: string;
}

export default function PublicProfileGuideClient({
  guideId,
  displayName,
  primaryColor,
  logoUrl,
  tagline,
  links,
  source,
}: PublicProfileGuideClientProps) {
  useEffect(() => {
    trackProfileGuideEvent({
      name: "profile_guide_view",
      guideId,
      source: source ?? "direct",
    });
  }, [guideId, source]);

  return (
    <div className="min-h-dvh bg-[#f8f9fa] px-4 py-8">
      <div className="mx-auto max-w-md">
        <ProfileGuidePhonePreview
          displayName={displayName}
          primaryColor={primaryColor}
          logoUrl={logoUrl}
          tagline={tagline}
          links={links}
          guideId={guideId}
          interactive
          source={source}
        />
        <p className="mt-6 text-center text-xs text-[#80868b]">Powered by Reputation Boost</p>
      </div>
    </div>
  );
}
