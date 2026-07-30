import type { ProfileGuideFlyerTemplate } from "../theme";

export interface FlyerCopy {
  headline: string;
  subhead: string;
  cta: string;
  qrLabel: string;
  supportLine: string;
}

export const FLYER_TEMPLATE_COPY: Record<ProfileGuideFlyerTemplate, FlyerCopy> = {
  professional: {
    headline: "We'd love your feedback",
    subhead: "Your experience matters to our team",
    cta: "Thank you for helping us serve our community.",
    qrLabel: "Scan to leave a Google review",
    supportLine: "",
  },
  friendly: {
    headline: "Love your visit?",
    subhead: "Share the love with a quick Google review",
    cta: "A few words from you mean the world to us!",
    qrLabel: "Scan & review us on Google",
    supportLine: "",
  },
  bold: {
    headline: "REVIEW US!",
    subhead: "Tell Google about your experience",
    cta: "Help us stay the top choice in town.",
    qrLabel: "Scan the code to review",
    supportLine: "",
  },
};

export function resolveFlyerCopy(
  template: ProfileGuideFlyerTemplate,
  tagline?: string | null,
  supportLine = ""
): FlyerCopy {
  const base = FLYER_TEMPLATE_COPY[template];
  return {
    ...base,
    subhead: tagline?.trim() || base.subhead,
    supportLine: supportLine || base.supportLine,
  };
}
