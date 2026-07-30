"use client";

import { useState } from "react";
import { googleMapsUrlForBusiness } from "@/lib/google/maps-url";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";

interface ProfileGuidePanelProps {
  businessName: string;
  placeId?: string | null;
  mapsUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  address: string;
}

const DEFAULT_LINKS = [
  { id: "review", label: "Leave a Review", icon: "⭐" },
  { id: "directions", label: "Get Directions", icon: "📍" },
  { id: "website", label: "Visit Website", icon: "🌐" },
  { id: "book", label: "Book Appointment", icon: "📅" },
  { id: "services", label: "View Services", icon: "📋" },
  { id: "call", label: "Call Us", icon: "📞" },
  { id: "text", label: "Text Us", icon: "💬" },
] as const;

export default function ProfileGuidePanel({
  businessName,
  placeId,
  mapsUrl,
  website,
  phone,
  address,
}: ProfileGuidePanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const reviewUrl = googleReviewUrlForBusiness({
    placeId,
    mapsUrl,
    name: businessName,
    address,
  });
  const directionsUrl = googleMapsUrlForBusiness({ mapsUrl, name: businessName, address });

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
            <span className="rounded-full bg-[#fef7e0] px-3 py-1 text-xs font-semibold text-[#b06000]">
              Coming soon
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold opacity-60"
              disabled
            >
              Publish guide
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
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold opacity-60"
              disabled
            >
              Download QR code
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#202124]">Action buttons</h3>
          <p className="mt-1 text-sm text-[#5f6368]">
            These links will appear on your public guide. We&apos;ll auto-fill them from your Google
            Business Profile.
          </p>

          <ul className="mt-4 divide-y divide-[#e8eaed]">
            {DEFAULT_LINKS.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="text-lg">
                    {link.icon}
                  </span>
                  <span className="text-sm font-medium text-[#3c4043]">{link.label}</span>
                </div>
                <span className="text-xs font-medium text-[#80868b]">Auto from GBP</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#202124]">Analytics preview</h3>
          <p className="mt-3 text-sm leading-relaxed text-[#5f6368]">
            Your Profile Guide received <span className="font-semibold text-[#202124]">—</span> visits
            this month. Track total scans and see which buttons customers click over the last 7, 30,
            or 90 days.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["Total scans", "Visits (30d)", "Top button"].map((label) => (
              <div
                key={label}
                className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] px-4 py-3 text-center"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-[#80868b]">{label}</p>
                <p className="mt-1 text-2xl font-bold text-[#dadce0]">—</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[2rem] border border-[#dadce0] bg-white p-3 shadow-sm">
          <div className="rounded-[1.5rem] border border-[#e8eaed] bg-[#f8f9fa] p-4">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#80868b]">
              Mobile preview
            </p>
            <ProfileGuidePhonePreview
              businessName={businessName}
              reviewUrl={reviewUrl}
              directionsUrl={directionsUrl}
              website={website}
              phone={phone}
            />
          </div>
        </div>
      </aside>

      {previewOpen && (
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
              businessName={businessName}
              reviewUrl={reviewUrl}
              directionsUrl={directionsUrl}
              website={website}
              phone={phone}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileGuidePhonePreview({
  businessName,
  reviewUrl,
  directionsUrl,
  website,
  phone,
}: {
  businessName: string;
  reviewUrl: string | null;
  directionsUrl: string | null;
  website?: string | null;
  phone?: string | null;
}) {
  const previewLinks = [
    { label: "Leave a Review", href: reviewUrl },
    { label: "Get Directions", href: directionsUrl },
    { label: "Visit Website", href: website },
    { label: "Call Us", href: phone ? `tel:${phone}` : null },
    { label: "Text Us", href: phone ? `sms:${phone}` : null },
  ].filter((link) => Boolean(link.href));

  return (
    <div className="mx-auto mt-3 max-w-[260px] overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-sm">
      <div className="bg-[#1a73e8] px-4 py-5 text-center text-white">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <p className="mt-3 text-base font-semibold">{businessName}</p>
        <p className="mt-1 text-xs text-white/80">Your local business guide</p>
      </div>
      <div className="space-y-2 p-3">
        {previewLinks.length > 0 ? (
          previewLinks.map((link) => (
            <div
              key={link.label}
              className="rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-center text-sm font-medium text-[#3c4043]"
            >
              {link.label}
            </div>
          ))
        ) : (
          <p className="px-2 py-6 text-center text-sm text-[#80868b]">
            Connect your Google Business Profile to preview your guide links.
          </p>
        )}
      </div>
    </div>
  );
}
