"use client";

import { trackProfileGuideEvent } from "@/lib/analytics/profile-guide-events";
import {
  buttonRadiusClass,
  FONT_PRESET_STYLES,
  type ProfileGuideButtonStyle,
  type ProfileGuideFontPreset,
} from "@/lib/profile-guide/theme";

export interface ProfileGuidePreviewLink {
  id?: string;
  label: string;
  url: string;
  enabled?: boolean;
}

export interface ProfileGuidePhonePreviewProps {
  displayName: string;
  primaryColor?: string;
  backgroundColor?: string;
  buttonStyle?: ProfileGuideButtonStyle;
  fontPreset?: ProfileGuideFontPreset;
  logoUrl?: string | null;
  tagline?: string | null;
  links: ProfileGuidePreviewLink[];
  guideId?: string;
  interactive?: boolean;
  source?: string;
}

export default function ProfileGuidePhonePreview({
  displayName,
  primaryColor = "#1a73e8",
  backgroundColor = "#f8f9fa",
  buttonStyle = "rounded",
  fontPreset = "professional",
  logoUrl,
  tagline,
  links,
  guideId,
  interactive = false,
  source,
}: ProfileGuidePhonePreviewProps) {
  const fonts = FONT_PRESET_STYLES[fontPreset];
  const radiusClass = buttonRadiusClass(buttonStyle);
  const visibleLinks = links.filter((link) => link.enabled !== false && link.url.trim());

  function handleClick(link: ProfileGuidePreviewLink) {
    if (!interactive || !guideId || !link.id) return;
    trackProfileGuideEvent({
      name: "profile_guide_click",
      guideId,
      linkId: link.id,
      source: source ?? "preview",
    });
    if (link.url.startsWith("tel:") || link.url.startsWith("sms:")) {
      window.location.href = link.url;
      return;
    }
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="mx-auto mt-3 max-w-[260px] overflow-hidden rounded-2xl border border-[#dadce0] shadow-sm"
      style={{ backgroundColor, fontFamily: fonts.body }}
    >
      <div className="px-4 py-5 text-center text-white" style={{ backgroundColor: primaryColor }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="mx-auto h-14 w-14 rounded-full border-2 border-white/30 object-cover"
          />
        ) : (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <p className="mt-3 text-base font-semibold" style={{ fontFamily: fonts.heading }}>
          {displayName}
        </p>
        <p className="mt-1 text-xs text-white/80">{tagline || "Your local business guide"}</p>
      </div>
      <div className="space-y-2 p-3">
        {visibleLinks.length > 0 ? (
          visibleLinks.map((link) =>
            interactive ? (
              <button
                key={link.id ?? link.label}
                type="button"
                onClick={() => handleClick(link)}
                className={`w-full border border-[#dadce0] bg-white px-3 py-2.5 text-center text-sm font-medium text-[#3c4043] transition hover:bg-[#f8f9fa] ${radiusClass}`}
              >
                {link.label}
              </button>
            ) : (
              <div
                key={link.id ?? link.label}
                className={`border border-[#dadce0] bg-white px-3 py-2.5 text-center text-sm font-medium text-[#3c4043] ${radiusClass}`}
              >
                {link.label}
              </div>
            )
          )
        ) : (
          <p className="px-2 py-6 text-center text-sm text-[#80868b]">
            Add at least one enabled link to preview your guide.
          </p>
        )}
      </div>
    </div>
  );
}
