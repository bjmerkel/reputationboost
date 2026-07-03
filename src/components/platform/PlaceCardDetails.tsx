"use client";

import type { FullAuditPayload } from "@/audit/types";
import GoogleMapsLink from "@/components/GoogleMapsLink";

interface PlaceCardDetailsProps {
  audit: FullAuditPayload;
}

export default function PlaceCardDetails({ audit }: PlaceCardDetailsProps) {
  const { gbp, strategy } = audit;
  const score = strategy?.scores.overall ?? 0;
  const grade = strategy?.scores.grade ?? "at_risk";
  const website = gbp.identity.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const gradeColor =
    grade === "healthy" ? "#188038" : grade === "urgent" ? "#d93025" : "#e37400";

  return (
    <div className="space-y-3 border-b border-[#dadce0] px-4 py-3">
      <div className="flex items-center gap-3">
        <ListingStrengthRing score={score} color={gradeColor} />
        <div>
          <p className="text-xs font-medium text-[#5f6368]">Listing strength</p>
          <p className="text-sm font-medium text-[#202124]">
            {score}/100 · {grade.replace("_", " ")}
          </p>
        </div>
      </div>

      <ul className="space-y-2.5 text-sm">
        {gbp.identity.address && (
          <DetailRow
            icon={<PinIcon />}
            content={gbp.identity.address}
          />
        )}

        <DetailRow
          icon={<ClockIcon />}
          content={
            gbp.completeness.hasHours
              ? gbp.completeness.hasHolidayHours
                ? "Hours listed · holiday hours set"
                : "Hours listed · add holiday hours"
              : "Add business hours on Google"
          }
          muted={!gbp.completeness.hasHours}
        />

        {website && (
          <DetailRow
            icon={<GlobeIcon />}
            content={
              <a
                href={gbp.identity.website.startsWith("http") ? gbp.identity.website : `https://${gbp.identity.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1a73e8] hover:underline"
              >
                {website}
              </a>
            }
          />
        )}

        {gbp.identity.phone && (
          <DetailRow
            icon={<PhoneIcon />}
            content={
              <a href={`tel:${gbp.identity.phone}`} className="text-[#1a73e8] hover:underline">
                {gbp.identity.phone}
              </a>
            }
          />
        )}
      </ul>

      <GoogleMapsLink
        mapsUrl={gbp.identity.mapsUrl}
        name={gbp.identity.name}
        address={gbp.identity.address}
        className="inline-flex text-xs font-medium text-[#1a73e8] hover:underline"
        label="View on Google Maps →"
      />
    </div>
  );
}

function DetailRow({
  icon,
  content,
  muted = false,
}: {
  icon: React.ReactNode;
  content: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[#007b83]">{icon}</span>
      <span className={muted ? "text-[#80868b]" : "text-[#3c4043]"}>{content}</span>
    </li>
  );
}

function ListingStrengthRing({ score, color }: { score: number; color: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#e8eaed" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" className="fill-[#202124] text-[10px] font-bold">
        {score}
      </text>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.97.633-3.794 1.716-5.282" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z" />
    </svg>
  );
}
