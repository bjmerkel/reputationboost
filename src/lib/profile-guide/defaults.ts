import type { ClientConfig } from "@/audit/types";
import { googleMapsUrlForBusiness } from "@/lib/google/maps-url";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import type { ProfileGuideLinkInput, ProfileGuideLinkType } from "./types";

const DEFAULT_LINK_META: Array<{
  linkType: ProfileGuideLinkType;
  label: string;
  buildUrl: (ctx: DefaultLinkContext) => string | null;
}> = [
  {
    linkType: "review",
    label: "Leave a Review",
    buildUrl: (ctx) =>
      googleReviewUrlForBusiness({
        placeId: ctx.placeId,
        mapsUrl: ctx.mapsUrl,
        name: ctx.name,
        address: ctx.address,
      }),
  },
  {
    linkType: "directions",
    label: "Get Directions",
    buildUrl: (ctx) =>
      googleMapsUrlForBusiness({
        mapsUrl: ctx.mapsUrl,
        name: ctx.name,
        address: ctx.address,
      }),
  },
  {
    linkType: "website",
    label: "Visit Website",
    buildUrl: (ctx) => ctx.website?.trim() || null,
  },
  {
    linkType: "book",
    label: "Book Appointment",
    buildUrl: (ctx) => ctx.bookUrl?.trim() || ctx.website?.trim() || null,
  },
  {
    linkType: "call",
    label: "Call Us",
    buildUrl: (ctx) => (ctx.phone?.trim() ? `tel:${ctx.phone.trim()}` : null),
  },
  {
    linkType: "text",
    label: "Text Us",
    buildUrl: (ctx) => (ctx.phone?.trim() ? `sms:${ctx.phone.trim()}` : null),
  },
];

interface DefaultLinkContext {
  name: string;
  address: string;
  placeId?: string | null;
  mapsUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  bookUrl?: string | null;
}

export function buildBusinessAddress(business: ClientConfig): string {
  return [
    business.location.address,
    business.location.city,
    business.location.state,
    business.location.zip,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildDefaultProfileGuideLinks(
  business: ClientConfig,
  options: { bookUrl?: string | null } = {}
): ProfileGuideLinkInput[] {
  const ctx: DefaultLinkContext = {
    name: business.name,
    address: buildBusinessAddress(business),
    placeId: business.gbpPlaceId,
    mapsUrl: business.gbpMapsUrl,
    website: business.website,
    phone: business.phone,
    bookUrl: options.bookUrl,
  };

  return DEFAULT_LINK_META.map((meta, index) => {
    const url = meta.buildUrl(ctx);
    return {
      linkType: meta.linkType,
      label: meta.label,
      url: url ?? "",
      sortOrder: index,
      enabled: Boolean(url),
    };
  });
}
