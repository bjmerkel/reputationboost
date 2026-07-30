"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import ProfileGuidePhonePreview from "@/components/profile-guide/ProfileGuidePhonePreview";
import ProfileGuideSectionTooltip from "@/components/profile-guide/ProfileGuideSectionTooltip";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import { customersTabHref } from "@/lib/customers/tabs";
import { formatSourceLabel } from "@/lib/profile-guide/analytics";
import {
  MAX_CUSTOM_PROFILE_GUIDE_LINKS,
  isNewProfileGuideLinkId,
} from "@/lib/profile-guide/link-helpers";
import type { ProfileGuideAnalyticsPeriod, ProfileGuideSourceStats } from "@/lib/profile-guide/types";
import {
  PROFILE_GUIDE_BUTTON_STYLES,
  PROFILE_GUIDE_FLYER_TEMPLATES,
  PROFILE_GUIDE_FONT_PRESETS,
  type ProfileGuideButtonStyle,
  type ProfileGuideFontPreset,
} from "@/lib/profile-guide/theme";
import { PROFILE_GUIDE_SECTION_TOOLTIPS } from "@/lib/profile-guide/section-tooltips";
import type { ProfileGuideSectionTooltip as ProfileGuideSectionTooltipContent } from "@/lib/profile-guide/section-tooltips";
import {
  FLYER_FORMAT_SPECS,
  PROFILE_GUIDE_FLYER_FORMATS,
  parseProfileGuideFlyerFormat,
  type ProfileGuideFlyerFormat,
} from "@/lib/profile-guide/flyer/formats";
import {
  DEFAULT_FLYER_DISPLAY_OPTIONS,
  type FlyerDisplayOptions,
} from "@/lib/profile-guide/flyer/options";

interface FlyerCopyPayload {
  headline: string;
  subhead: string;
  cta: string;
}

interface FlyerStudioCache {
  backgroundDataUrl: string;
  imagePrompt: string;
  copy: FlyerCopyPayload;
}

interface FlyerHistoryEntry {
  id: string;
  imageDataUrl: string;
  label: string;
  template: string;
  format: string;
  createdAt: string;
}

const MAX_FLYER_HISTORY = 3;

interface GuideLink {
  id: string;
  linkType: string;
  label: string;
  url: string;
  sortOrder: number;
  enabled: boolean;
}

interface GuideData {
  guide: {
    id: string;
    slug: string;
    displayName: string;
    published: boolean;
    publishedAt: string | null;
    primaryColor: string;
    backgroundColor: string;
    backgroundImageUrl: string | null;
    buttonStyle: ProfileGuideButtonStyle;
    fontPreset: ProfileGuideFontPreset;
    logoUrl: string | null;
    tagline: string | null;
    textMessage: string | null;
    gbpSyncedAt: string | null;
    publicUrl: string;
  };
  links: GuideLink[];
}

interface AnalyticsData {
  periodDays: ProfileGuideAnalyticsPeriod;
  totalViews: number;
  totalClicks: number;
  topLink: { id: string; label: string; clicks: number } | null;
  linkClicks: Array<{ id: string; label: string; linkType: string; clicks: number }>;
  sourceBreakdown: ProfileGuideSourceStats[];
  narrative: string;
  attributedReviews: number;
}

interface ProfileGuidePanelProps {
  businessId?: string;
}

const PERIODS: ProfileGuideAnalyticsPeriod[] = [7, 30, 90];

export default function ProfileGuidePanel({ businessId }: ProfileGuidePanelProps) {
  const [data, setData] = useState<GuideData | null>(null);
  const [links, setLinks] = useState<GuideLink[]>([]);
  const [primaryColor, setPrimaryColor] = useState("#1a73e8");
  const [backgroundColor, setBackgroundColor] = useState("#f8f9fa");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [buttonStyle, setButtonStyle] = useState<ProfileGuideButtonStyle>("rounded");
  const [fontPreset, setFontPreset] = useState<ProfileGuideFontPreset>("professional");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [tagline, setTagline] = useState("");
  const [textMessage, setTextMessage] = useState("");
  const [gbpSyncedAt, setGbpSyncedAt] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [period, setPeriod] = useState<ProfileGuideAnalyticsPeriod>(30);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [deletedLinkIds, setDeletedLinkIds] = useState<string[]>([]);
  const [flyerTemplate, setFlyerTemplate] =
    useState<(typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number]>("professional");
  const [flyerFormat, setFlyerFormat] = useState<ProfileGuideFlyerFormat>("letter");
  const [flyerGenerating, setFlyerGenerating] = useState(false);
  const [flyerPreview, setFlyerPreview] = useState<string | null>(null);
  const [flyerPromptRefinement, setFlyerPromptRefinement] = useState("");
  const [flyerDisplayOptions, setFlyerDisplayOptions] = useState<FlyerDisplayOptions>(
    DEFAULT_FLYER_DISPLAY_OPTIONS
  );
  const [flyerStudioCache, setFlyerStudioCache] = useState<FlyerStudioCache | null>(null);
  const [flyerHistory, setFlyerHistory] = useState<FlyerHistoryEntry[]>([]);
  const [selectedFlyerHistoryId, setSelectedFlyerHistoryId] = useState<string | null>(null);

  const loadGuide = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile-guide");
      const json = await parseJsonResponse<GuideData>(res);
      setData(json);
      setLinks(json.links);
      setPrimaryColor(json.guide.primaryColor);
      setBackgroundColor(json.guide.backgroundColor ?? "#f8f9fa");
      setBackgroundImageUrl(json.guide.backgroundImageUrl ?? null);
      setButtonStyle(json.guide.buttonStyle ?? "rounded");
      setFontPreset(json.guide.fontPreset ?? "professional");
      setLogoUrl(json.guide.logoUrl);
      setTagline(json.guide.tagline ?? "");
      setTextMessage(json.guide.textMessage ?? "");
      setGbpSyncedAt(json.guide.gbpSyncedAt ?? null);
      setPublished(json.guide.published);
      setDeletedLinkIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Profile Guide");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (days: ProfileGuideAnalyticsPeriod) => {
    try {
      const res = await fetch(`/api/profile-guide/analytics?period=${days}`);
      const json = await parseJsonResponse<{ analytics: AnalyticsData }>(res);
      setAnalytics(json.analytics);
    } catch {
      setAnalytics(null);
    }
  }, []);

  useEffect(() => {
    void loadGuide();
  }, [loadGuide, businessId]);

  useEffect(() => {
    if (!loading && data) {
      void loadAnalytics(period);
    }
  }, [loading, data, period, loadAnalytics]);

  const previewLinks = useMemo(
    () =>
      [...links]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((link) => ({
          id: link.id,
          label: link.label,
          url: link.url,
          enabled: link.enabled,
        })),
    [links]
  );

  async function saveGuide(overrides?: {
    published?: boolean;
    links?: GuideLink[];
    deletedLinkIds?: string[];
    primaryColor?: string;
    logoUrl?: string | null;
    backgroundImageUrl?: string | null;
    tagline?: string;
    successMessage?: string;
  }) {
    setSaving(true);
    setError(null);
    setMessage(null);

    const nextLinks = overrides?.links ?? links;
    const nextDeletedLinkIds = overrides?.deletedLinkIds ?? deletedLinkIds;
    const payload = {
      published: overrides?.published ?? published,
      primaryColor: overrides?.primaryColor ?? primaryColor,
      backgroundColor,
      buttonStyle,
      fontPreset,
      logoUrl: overrides?.logoUrl !== undefined ? overrides.logoUrl : logoUrl,
      backgroundImageUrl:
        overrides?.backgroundImageUrl !== undefined ? overrides.backgroundImageUrl : backgroundImageUrl,
      tagline: overrides?.tagline ?? tagline,
      textMessage,
      deletedLinkIds: nextDeletedLinkIds,
      links: nextLinks.map((link, index) => ({
        id: isNewProfileGuideLinkId(link.id) ? undefined : link.id,
        linkType: link.linkType,
        label: link.label,
        url: link.url,
        sortOrder: index,
        enabled: link.enabled,
      })),
    };

    try {
      const res = await fetch("/api/profile-guide", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonResponse<GuideData>(res);
      setData(json);
      setLinks(json.links);
      setPublished(json.guide.published);
      setDeletedLinkIds([]);
      setLogoUrl(json.guide.logoUrl);
      setBackgroundImageUrl(json.guide.backgroundImageUrl ?? null);
      setMessage(
        overrides?.successMessage ??
          (json.guide.published ? "Profile Guide published." : "Changes saved.")
      );
      void loadAnalytics(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Profile Guide");
    } finally {
      setSaving(false);
    }
  }

  function updateLink(id: string, patch: Partial<GuideLink>) {
    setLinks((current) => current.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  }

  function moveLink(id: string, direction: -1 | 1) {
    setLinks((current) => {
      const sorted = [...current].sort((a, b) => a.sortOrder - b.sortOrder);
      const index = sorted.findIndex((link) => link.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sorted.length) return current;

      const next = [...sorted];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((link, sortOrder) => ({ ...link, sortOrder }));
    });
  }

  function addCustomButton() {
    const customCount = links.filter((link) => link.linkType === "custom").length;
    if (customCount >= MAX_CUSTOM_PROFILE_GUIDE_LINKS) {
      setError(`You can add up to ${MAX_CUSTOM_PROFILE_GUIDE_LINKS} custom buttons.`);
      return;
    }

    setError(null);
    setLinks((current) => [
      ...current,
      {
        id: `new-${crypto.randomUUID()}`,
        linkType: "custom",
        label: "Custom button",
        url: "https://",
        sortOrder: current.length,
        enabled: true,
      },
    ]);
  }

  function removeCustomButton(id: string) {
    if (!isNewProfileGuideLinkId(id)) {
      setDeletedLinkIds((current) => [...current, id]);
    }
    setLinks((current) => current.filter((link) => link.id !== id));
  }

  const customButtonCount = links.filter((link) => link.linkType === "custom").length;

  async function handleLogoUpload(file: File | null) {
    if (!file) return;
    if (file.size > 200_000) {
      setError("Logo must be under 200 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setLogoUrl(result);
      void saveGuide({
        logoUrl: result,
        successMessage: published ? "Logo saved." : "Logo saved as draft.",
      });
    };
    reader.readAsDataURL(file);
  }

  async function copyPublicUrl() {
    if (!data?.guide.publicUrl) return;
    await navigator.clipboard.writeText(data.guide.publicUrl);
    setMessage("Public link copied.");
  }

  function downloadQr() {
    window.location.href = "/api/profile-guide/qr";
  }

  const qrPreviewSrc = data
    ? `/api/profile-guide/qr?inline=1&v=${encodeURIComponent(primaryColor)}`
    : null;

  async function syncFromGoogle() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile-guide?action=sync", { method: "POST" });
      const json = await parseJsonResponse<GuideData>(res);
      setData(json);
      setLinks(json.links);
      setGbpSyncedAt(json.guide.gbpSyncedAt ?? null);
      setMessage("Synced links from your Google Business Profile.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync from Google");
    } finally {
      setSaving(false);
    }
  }

  function openFlyer(template: (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number]) {
    window.open(`/api/profile-guide/flyer?template=${template}`, "_blank", "noopener,noreferrer");
  }

  async function generateAiFlyer(mode: "generate" | "regenerate" | "recompose" = "generate") {
    setFlyerGenerating(true);
    setError(null);
    setMessage(null);

    const payload: Record<string, unknown> = {
      template: flyerTemplate,
      format: flyerFormat,
      displayOptions: flyerDisplayOptions,
    };

    if (mode === "generate" || mode === "regenerate") {
      if (flyerPromptRefinement.trim()) {
        payload.promptRefinement = flyerPromptRefinement.trim();
      }
    } else if (mode === "recompose") {
      if (!flyerStudioCache) {
        setError("Generate a flyer first before updating the layout.");
        setFlyerGenerating(false);
        return;
      }
      payload.backgroundDataUrl = flyerStudioCache.backgroundDataUrl;
      payload.imagePrompt = flyerStudioCache.imagePrompt;
      payload.copy = flyerStudioCache.copy;
    }

    try {
      const res = await fetch("/api/profile-guide/flyer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonResponse<{
        imageDataUrl: string;
        backgroundDataUrl: string;
        imagePrompt: string;
        copy: FlyerCopyPayload;
        recomposedOnly: boolean;
        template: string;
        format: string;
      }>(res);

      setFlyerPreview(json.imageDataUrl);
      setFlyerStudioCache({
        backgroundDataUrl: json.backgroundDataUrl,
        imagePrompt: json.imagePrompt,
        copy: json.copy,
      });

      if (!json.recomposedOnly) {
        const entry: FlyerHistoryEntry = {
          id: crypto.randomUUID(),
          imageDataUrl: json.imageDataUrl,
          label: `${json.template} · ${FLYER_FORMAT_SPECS[flyerFormat].label}`,
          template: json.template,
          format: json.format,
          createdAt: new Date().toISOString(),
        };
        setFlyerHistory((current) => [entry, ...current].slice(0, MAX_FLYER_HISTORY));
        setSelectedFlyerHistoryId(entry.id);
      }

      setMessage(
        mode === "recompose"
          ? "Flyer layout updated."
          : mode === "regenerate"
            ? "Flyer background regenerated."
            : "AI review flyer generated."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI flyer");
    } finally {
      setFlyerGenerating(false);
    }
  }

  function updateFlyerDisplayOption<K extends keyof FlyerDisplayOptions>(
    key: K,
    value: FlyerDisplayOptions[K]
  ) {
    setFlyerDisplayOptions((current) => ({ ...current, [key]: value }));
  }

  function restoreFlyerHistory(entry: FlyerHistoryEntry) {
    setFlyerPreview(entry.imageDataUrl);
    setFlyerTemplate(entry.template as (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number]);
    setFlyerFormat(parseProfileGuideFlyerFormat(entry.format));
    setSelectedFlyerHistoryId(entry.id);
    setMessage("Restored a previous flyer version.");
  }

  function downloadFlyerPreview() {
    if (!flyerPreview) return;
    const link = document.createElement("a");
    link.href = flyerPreview;
    link.download = `profile-guide-flyer-${flyerTemplate}-${flyerFormat}.png`;
    link.click();
  }

  const auditPhotosHref = businessId
    ? `/platform/audit?businessId=${businessId}&view=audit`
    : "/platform/audit?view=audit";

  const outreachHref = customersTabHref("review-requests", businessId);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-8 text-center text-sm text-[#5f6368]">
        Loading your Profile Guide…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-[#fce8e6] bg-[#fef7f7] p-6 text-sm text-[#c5221f]">
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionTitle
                as="h2"
                className="text-lg font-bold text-[#202124]"
                tooltip={PROFILE_GUIDE_SECTION_TOOLTIPS.overview}
              >
                Your Profile Guide
              </SectionTitle>
              <p className="mt-1 max-w-xl text-sm text-[#5f6368]">
                Share a branded mobile page and QR code so customers can review you, get directions,
                call, or book — all from one scan.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                published
                  ? "bg-[#e6f4ea] text-[#137333]"
                  : "bg-[#fef7e0] text-[#b06000]"
              }`}
            >
              {published ? "Live" : "Draft"}
            </span>
          </div>

          {data?.guide.publicUrl && (
            <p className="mt-4 break-all text-sm text-[#5f6368]">
              Public URL:{" "}
              <a
                href={data.guide.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1a73e8] hover:underline"
              >
                {data.guide.publicUrl}
              </a>
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveGuide({ published: !published })}
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {published ? "Unpublish" : "Publish guide"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveGuide()}
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Preview Your Profile Guide
            </button>
            <button
              type="button"
              onClick={downloadQr}
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Download QR code
            </button>
            <button
              type="button"
              onClick={() => void copyPublicUrl()}
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Copy link
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void syncFromGoogle()}
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Refresh from Google
            </button>
          </div>

          {gbpSyncedAt && (
            <p className="mt-3 text-xs text-[#80868b]">
              Last synced from Google: {new Date(gbpSyncedAt).toLocaleString()}
            </p>
          )}

          {published && (
            <p className="mt-3 text-sm text-[#5f6368]">
              Use your Profile Guide in review outreach —{" "}
              <Link href={outreachHref} className="font-medium text-[#1a73e8] hover:underline">
                send it via SMS or email
              </Link>
              .
            </p>
          )}

          {(error || message) && (
            <p
              className={`mt-4 text-sm ${error ? "text-[#c5221f]" : "text-[#137333]"}`}
              role="status"
            >
              {error ?? message}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <SectionTitle
            tooltip={PROFILE_GUIDE_SECTION_TOOLTIPS.branding}
            className="text-base font-semibold text-[#202124]"
          >
            Branding & theme
          </SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-[#3c4043]">Primary color</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-[#dadce0]"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#3c4043]">Background color</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(event) => setBackgroundColor(event.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-[#dadce0]"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(event) => setBackgroundColor(event.target.value)}
                  className="w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#3c4043]">Button style</span>
              <select
                value={buttonStyle}
                onChange={(event) =>
                  setButtonStyle(event.target.value as ProfileGuideButtonStyle)
                }
                className="mt-2 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              >
                {PROFILE_GUIDE_BUTTON_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#3c4043]">Font preset</span>
              <select
                value={fontPreset}
                onChange={(event) => setFontPreset(event.target.value as ProfileGuideFontPreset)}
                className="mt-2 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              >
                {PROFILE_GUIDE_FONT_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-[#3c4043]">Tagline</span>
              <input
                type="text"
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Your local business guide"
                className="mt-2 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-[#3c4043]">Text Us default message</span>
              <input
                type="text"
                value={textMessage}
                onChange={(event) => setTextMessage(event.target.value)}
                placeholder="Hi, I'd like to get in touch…"
                className="mt-2 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-[#3c4043]">Cover photo</span>
              <p className="mt-1 text-xs text-[#80868b]">
                Click any photo in{" "}
                <Link href={auditPhotosHref} className="font-medium text-[#1a73e8] hover:underline">
                  Audit → Photos &amp; videos
                </Link>{" "}
                to set your Profile Guide cover. You&apos;ll stay on the audit page.
              </p>
              {backgroundImageUrl ? (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={backgroundImageUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-[#dadce0] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => void saveGuide({ backgroundImageUrl: null })}
                    className="text-sm font-medium text-[#1a73e8]"
                  >
                    Remove cover photo
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#80868b]">No cover photo selected.</p>
              )}
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-[#3c4043]">Logo</span>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleLogoUpload(event.target.files?.[0] ?? null)}
                  className="text-sm text-[#5f6368]"
                />
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="text-sm font-medium text-[#1a73e8]"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <SectionTitle
            tooltip={PROFILE_GUIDE_SECTION_TOOLTIPS.reviewFlyer}
            className="text-base font-semibold text-[#202124]"
          >
            Review flyer
          </SectionTitle>
          <p className="mt-1 text-sm text-[#5f6368]">
            Generate a professional AI flyer with your logo, cover photo, QR code, and business
            details — or use a simple printable template.
          </p>

          <div className="mt-4">
            <p className="text-sm font-medium text-[#3c4043]">Format</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROFILE_GUIDE_FLYER_FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setFlyerFormat(format)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    flyerFormat === format
                      ? "bg-[#e8f0fe] text-[#1a73e8]"
                      : "border border-[#dadce0] text-[#5f6368] hover:text-[#3c4043]"
                  }`}
                >
                  {FLYER_FORMAT_SPECS[format].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#80868b]">
              {FLYER_FORMAT_SPECS[flyerFormat].description}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-[#3c4043]">Style</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROFILE_GUIDE_FLYER_TEMPLATES.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setFlyerTemplate(template)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                    flyerTemplate === template
                      ? "bg-[#e8f0fe] text-[#1a73e8]"
                      : "border border-[#dadce0] text-[#5f6368] hover:text-[#3c4043]"
                  }`}
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-[#3c4043]">Flyer studio</p>
            <label className="mt-2 block text-sm">
              <span className="text-[#5f6368]">Creative direction (optional)</span>
              <textarea
                value={flyerPromptRefinement}
                onChange={(event) => setFlyerPromptRefinement(event.target.value)}
                placeholder="e.g. Make it warmer, more minimalist, or add subtle fall colors"
                rows={3}
                className="mt-2 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#3c4043]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={flyerDisplayOptions.showPhone}
                  onChange={(event) => updateFlyerDisplayOption("showPhone", event.target.checked)}
                />
                Show phone
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={flyerDisplayOptions.showAddress}
                  onChange={(event) =>
                    updateFlyerDisplayOption("showAddress", event.target.checked)
                  }
                />
                Show address
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={flyerDisplayOptions.showStars}
                  onChange={(event) => updateFlyerDisplayOption("showStars", event.target.checked)}
                />
                Show stars
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={flyerDisplayOptions.showTagline}
                  onChange={(event) =>
                    updateFlyerDisplayOption("showTagline", event.target.checked)
                  }
                />
                Use tagline
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={flyerGenerating}
              onClick={() => void generateAiFlyer("generate")}
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {flyerGenerating ? "Working…" : "Generate AI flyer"}
            </button>
            {flyerStudioCache && (
              <>
                <button
                  type="button"
                  disabled={flyerGenerating}
                  onClick={() => void generateAiFlyer("regenerate")}
                  className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  Regenerate background
                </button>
                <button
                  type="button"
                  disabled={flyerGenerating}
                  onClick={() => void generateAiFlyer("recompose")}
                  className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  Update layout
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => openFlyer(flyerTemplate)}
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Simple template
            </button>
            {flyerPreview && (
              <button
                type="button"
                onClick={downloadFlyerPreview}
                className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                Download PNG
              </button>
            )}
          </div>

          {flyerGenerating && (
            <p className="mt-3 text-sm text-[#5f6368]">
              {flyerStudioCache
                ? "Updating your flyer…"
                : "Designing your flyer with AI… this usually takes 15–30 seconds."}
            </p>
          )}

          {flyerPreview && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8eaed] bg-[#f8f9fa] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#80868b]">
                AI flyer preview
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={flyerPreview}
                alt="AI-generated review flyer preview"
                className="mx-auto max-h-[520px] w-auto rounded-lg shadow-sm"
              />
            </div>
          )}

          {flyerHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-[#3c4043]">Recent versions</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {flyerHistory.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => restoreFlyerHistory(entry)}
                    className={`overflow-hidden rounded-lg border text-left shadow-sm ${
                      selectedFlyerHistoryId === entry.id
                        ? "border-[#1a73e8] ring-2 ring-[#e8f0fe]"
                        : "border-[#e8eaed]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.imageDataUrl}
                      alt={entry.label}
                      className="h-24 w-16 object-cover"
                    />
                    <span className="block px-2 py-1 text-xs text-[#5f6368]">{entry.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-[#80868b]">
            Use Update layout to apply display toggles without a new AI background. Regenerate uses
            your creative direction for a fresh design.
          </p>
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle
                tooltip={PROFILE_GUIDE_SECTION_TOOLTIPS.actionButtons}
                className="text-base font-semibold text-[#202124]"
              >
                Action buttons
              </SectionTitle>
              <p className="mt-1 text-sm text-[#5f6368]">
                Add custom buttons, reorder, toggle, and edit the links on your public guide.
              </p>
            </div>
            <button
              type="button"
              onClick={addCustomButton}
              disabled={customButtonCount >= MAX_CUSTOM_PROFILE_GUIDE_LINKS}
              className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Add custom button
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {[...links]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((link, index, sorted) => {
                const isCustom = link.linkType === "custom";
                return (
                <li
                  key={link.id}
                  className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-[#3c4043]">
                        <input
                          type="checkbox"
                          checked={link.enabled}
                          onChange={(event) =>
                            updateLink(link.id, { enabled: event.target.checked })
                          }
                        />
                        Enabled
                      </label>
                      {isCustom && (
                        <span className="rounded-full bg-[#e8f0fe] px-2 py-0.5 text-xs font-semibold text-[#1a73e8]">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => removeCustomButton(link.id)}
                          className="rounded-full border border-[#fce8e6] px-3 py-1 text-xs font-medium text-[#c5221f]"
                        >
                          Remove
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveLink(link.id, -1)}
                        className="rounded-full border border-[#dadce0] px-2 py-1 text-xs disabled:opacity-40"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === sorted.length - 1}
                        onClick={() => moveLink(link.id, 1)}
                        className="rounded-full border border-[#dadce0] px-2 py-1 text-xs disabled:opacity-40"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="text-[#5f6368]">Label</span>
                      <input
                        type="text"
                        value={link.label}
                        onChange={(event) => updateLink(link.id, { label: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#dadce0] bg-white px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm sm:col-span-1">
                      <span className="text-[#5f6368]">URL</span>
                      <input
                        type="text"
                        value={link.url}
                        onChange={(event) => updateLink(link.id, { url: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#dadce0] bg-white px-3 py-2"
                      />
                    </label>
                  </div>
                </li>
              );
              })}
          </ul>
          {customButtonCount > 0 && (
            <p className="mt-3 text-xs text-[#80868b]">
              {customButtonCount} of {MAX_CUSTOM_PROFILE_GUIDE_LINKS} custom buttons used.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle
              tooltip={PROFILE_GUIDE_SECTION_TOOLTIPS.analytics}
              className="text-base font-semibold text-[#202124]"
            >
              Analytics
            </SectionTitle>
            <div className="flex rounded-full border border-[#dadce0] p-1">
              {PERIODS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriod(days)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    period === days
                      ? "bg-[#e8f0fe] text-[#1a73e8]"
                      : "text-[#5f6368] hover:text-[#3c4043]"
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[#5f6368]">
            {analytics?.narrative ??
              "Analytics will appear once customers start visiting your guide."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <StatCard label="Total visits" value={analytics?.totalViews ?? 0} />
            <StatCard label="Total clicks" value={analytics?.totalClicks ?? 0} />
            <StatCard label="Top button" value={analytics?.topLink?.label ?? "—"} isText />
            <StatCard label="Attributed reviews" value={analytics?.attributedReviews ?? 0} />
          </div>

          {analytics && analytics.sourceBreakdown.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-[#3c4043]">Traffic sources</h4>
              <ul className="mt-2 divide-y divide-[#e8eaed] rounded-lg border border-[#e8eaed]">
                {analytics.sourceBreakdown.map((row) => (
                  <li
                    key={row.source}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-[#3c4043]">
                      {formatSourceLabel(row.source)}
                    </span>
                    <span className="text-[#5f6368]">
                      {row.views} visits · {row.clicks} clicks
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analytics && analytics.linkClicks.length > 0 && (
            <ul className="mt-4 divide-y divide-[#e8eaed] rounded-lg border border-[#e8eaed]">
              {analytics.linkClicks.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="font-medium text-[#3c4043]">{row.label}</span>
                  <span className="text-[#5f6368]">{row.clicks} clicks</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[2rem] border border-[#dadce0] bg-white p-3 shadow-sm">
          <div className="rounded-[1.5rem] border border-[#e8eaed] bg-[#f8f9fa] p-4">
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#80868b]">
                Live mobile preview
              </p>
              <ProfileGuideSectionTooltip content={PROFILE_GUIDE_SECTION_TOOLTIPS.livePreview} />
            </div>
            <ProfileGuidePhonePreview
              displayName={data?.guide.displayName ?? "Your business"}
              primaryColor={primaryColor}
              backgroundColor={backgroundColor}
              backgroundImageUrl={backgroundImageUrl}
              buttonStyle={buttonStyle}
              fontPreset={fontPreset}
              logoUrl={logoUrl}
              tagline={tagline}
              links={previewLinks}
            />
          </div>
        </div>

        {qrPreviewSrc && (
          <div className="rounded-[2rem] border border-[#dadce0] bg-white p-3 shadow-sm">
            <div className="rounded-[1.5rem] border border-[#e8eaed] bg-[#f8f9fa] p-4">
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#80868b]">
                  QR code
                </p>
                <ProfileGuideSectionTooltip content={PROFILE_GUIDE_SECTION_TOOLTIPS.qrCode} />
              </div>
              <div className="mt-3 flex justify-center rounded-xl bg-white p-3">
                <img
                  src={qrPreviewSrc}
                  alt="QR code for your Profile Guide"
                  width={192}
                  height={192}
                  className="h-48 w-48"
                />
              </div>
              <p className="mt-3 text-center text-sm text-[#5f6368]">
                Customers scan this to open your Profile Guide.
              </p>
              <button
                type="button"
                onClick={downloadQr}
                className="btn-secondary mt-3 w-full rounded-full px-4 py-2 text-sm font-semibold"
              >
                Download QR code
              </button>
            </div>
          </div>
        )}
      </aside>

      {previewOpen && data && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-guide-preview-title"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="profile-guide-preview-title" className="text-sm font-semibold text-[#202124]">
                Preview Your Profile Guide
              </h2>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-full p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <ProfileGuidePhonePreview
              displayName={data.guide.displayName}
              primaryColor={primaryColor}
              backgroundColor={backgroundColor}
              backgroundImageUrl={backgroundImageUrl}
              buttonStyle={buttonStyle}
              fontPreset={fontPreset}
              logoUrl={logoUrl}
              tagline={tagline}
              links={previewLinks}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({
  children,
  tooltip,
  className = "",
  as: Tag = "h3",
}: {
  children: ReactNode;
  tooltip: ProfileGuideSectionTooltipContent;
  className?: string;
  as?: "h2" | "h3" | "h4";
}) {
  return (
    <div className="flex items-center gap-2">
      <Tag className={className}>{children}</Tag>
      <ProfileGuideSectionTooltip content={tooltip} />
    </div>
  );
}

function StatCard({
  label,
  value,
  isText = false,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] px-4 py-3 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-[#80868b]">{label}</p>
      <p
        className={`mt-1 font-bold text-[#202124] ${
          isText ? "truncate text-sm" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
