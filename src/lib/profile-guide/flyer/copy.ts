import type { ProfileGuideFlyerTemplate } from "../theme";

export interface FlyerCopy {
  headline: string;
  subhead: string;
  cta: string;
}

export const FLYER_TEMPLATE_COPY: Record<ProfileGuideFlyerTemplate, FlyerCopy> = {
  professional: {
    headline: "We'd love your feedback",
    subhead: "Scan to leave us a Google review",
    cta: "Your review helps our local business grow.",
  },
  friendly: {
    headline: "Love your visit?",
    subhead: "Scan & share the love on Google",
    cta: "A quick review means the world to our team!",
  },
  bold: {
    headline: "REVIEW US!",
    subhead: "Scan the code. Leave a review.",
    cta: "Help us stay the top choice in town.",
  },
};

export function resolveFlyerCopy(
  template: ProfileGuideFlyerTemplate,
  tagline?: string | null
): FlyerCopy & { subhead: string } {
  const base = FLYER_TEMPLATE_COPY[template];
  const customSubhead = tagline?.trim();
  return {
    ...base,
    subhead: customSubhead || base.subhead,
  };
}
