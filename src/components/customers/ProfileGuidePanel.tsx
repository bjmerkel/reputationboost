"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProfileGuidePhonePreview from "@/components/profile-guide/ProfileGuidePhonePreview";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import { customersTabHref } from "@/lib/customers/tabs";
import { formatSourceLabel } from "@/lib/profile-guide/analytics";
import type { ProfileGuideAnalyticsPeriod, ProfileGuideSourceStats } from "@/lib/profile-guide/types";
import {
  PROFILE_GUIDE_BUTTON_STYLES,
  PROFILE_GUIDE_FLYER_TEMPLATES,
  PROFILE_GUIDE_FONT_PRESETS,
  type ProfileGuideButtonStyle,
  type ProfileGuideFontPreset,
} from "@/lib/profile-guide/theme";

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
      setButtonStyle(json.guide.buttonStyle ?? "rounded");
      setFontPreset(json.guide.fontPreset ?? "professional");
      setLogoUrl(json.guide.logoUrl);
      setTagline(json.guide.tagline ?? "");
      setTextMessage(json.guide.textMessage ?? "");
      setGbpSyncedAt(json.guide.gbpSyncedAt ?? null);
      setPublished(json.guide.published);
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
    primaryColor?: string;
    logoUrl?: string | null;
    tagline?: string;
  }) {
    setSaving(true);
    setError(null);
    setMessage(null);

    const nextLinks = overrides?.links ?? links;
    const payload = {
      published: overrides?.published ?? published,
      primaryColor: overrides?.primaryColor ?? primaryColor,
      backgroundColor,
      buttonStyle,
      fontPreset,
      logoUrl: overrides?.logoUrl !== undefined ? overrides.logoUrl : logoUrl,
      tagline: overrides?.tagline ?? tagline,
      textMessage,
      links: nextLinks.map((link, index) => ({
        id: link.id,
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
      setMessage(json.guide.published ? "Profile Guide published." : "Changes saved.");
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

  async function handleLogoUpload(file: File | null) {
    if (!file) return;
    if (file.size > 200_000) {
      setError("Logo must be under 200 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setLogoUrl(result);
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
              <h2 className="text-lg font-bold text-[#202124]">Your Profile Guide</h2>
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
          <h3 className="text-base font-semibold text-[#202124]">Branding & theme</h3>
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
          <h3 className="text-base font-semibold text-[#202124]">Review flyer</h3>
          <p className="mt-1 text-sm text-[#5f6368]">
            Generate a print-ready flyer with your QR code. Pick a style and print from your browser.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {PROFILE_GUIDE_FLYER_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => openFlyer(template)}
                className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold capitalize"
              >
                {template} flyer
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#202124]">Action buttons</h3>
          <p className="mt-1 text-sm text-[#5f6368]">
            Reorder, toggle, and edit the links on your public guide.
          </p>

          <ul className="mt-4 space-y-3">
            {[...links]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((link, index, sorted) => (
                <li
                  key={link.id}
                  className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                    <div className="flex items-center gap-2">
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
              ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-[#202124]">Analytics</h3>
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

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[2rem] border border-[#dadce0] bg-white p-3 shadow-sm">
          <div className="rounded-[1.5rem] border border-[#e8eaed] bg-[#f8f9fa] p-4">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#80868b]">
              Live mobile preview
            </p>
            <ProfileGuidePhonePreview
              displayName={data?.guide.displayName ?? "Your business"}
              primaryColor={primaryColor}
              backgroundColor={backgroundColor}
              buttonStyle={buttonStyle}
              fontPreset={fontPreset}
              logoUrl={logoUrl}
              tagline={tagline}
              links={previewLinks}
            />
          </div>
        </div>
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
