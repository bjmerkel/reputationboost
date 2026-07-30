export interface ProfileGuideSectionTooltip {
  title: string;
  what: string;
  why: string;
  examples: string;
}

export const PROFILE_GUIDE_SECTION_TOOLTIPS = {
  overview: {
    title: "Your Profile Guide",
    what: "A branded mobile page with one link and one QR code that sends customers to review you, get directions, call, book, or take any action you choose.",
    why: "Most customers decide on their phone. A single guide removes friction, keeps your brand consistent, and makes it easy to drive Google reviews and engagement from in-store signage, receipts, email, and SMS.",
    examples:
      "Publish your guide, print the QR for your front desk, add the link to your email signature, and text it after appointments so customers can leave a review in one tap.",
  },
  branding: {
    title: "Branding & theme",
    what: "Controls how your public guide looks — colors, fonts, button style, logo, cover photo, tagline, and the default Text Us message.",
    why: "A polished, on-brand page builds trust and gets more clicks. Customers are more likely to leave a review when the page feels like your business, not a generic link list.",
    examples:
      "Match your primary color to your logo, add a storefront photo as the cover, set a friendly tagline like \"Thanks for visiting!\", and pre-fill Text Us with \"Hi, I'd like to schedule an appointment.\"",
  },
  reviewFlyer: {
    title: "Review flyer",
    what: "AI-generated or simple print-ready flyers with your QR code, logo, cover photo, and business details in multiple formats.",
    why: "In-person review asks work best with something professional to scan. A branded flyer at checkout turns a verbal request into an instant Google review.",
    examples:
      "Generate a Letter flyer for your front desk, a Story for Instagram, or a 4×6 postcard to tuck into receipts.",
  },
  actionButtons: {
    title: "Action buttons",
    what: "The links customers see on your guide — review, directions, website, book, call, text, plus any custom buttons you add.",
    why: "You control what actions customers take first. Put your highest-priority action at the top and hide anything that doesn't apply to your business.",
    examples:
      "Move Leave a Review to the top during a review push, disable Book if you don't take online appointments, and add a custom button for your menu or patient forms.",
  },
  analytics: {
    title: "Analytics",
    what: "Tracks visits, button clicks, traffic sources, and reviews attributed to your Profile Guide over the last 7, 30, or 90 days.",
    why: "Shows what's working so you can double down — whether QR signage, SMS outreach, or a specific button drives the most engagement.",
    examples:
      "Check if QR scans spike after putting a code at the register, compare 30-day clicks on Review vs. Directions, and see how many reviews came from guide traffic.",
  },
  livePreview: {
    title: "Live mobile preview",
    what: "A real-time preview of your guide as customers will see it on their phone.",
    why: "Catch layout and branding issues before publishing — button order, colors, and copy all update as you edit.",
    examples:
      "Toggle a button off and confirm it disappears, try a darker background color, and check that your logo and tagline look right on a small screen.",
  },
  qrCode: {
    title: "QR code",
    what: "A scannable code that opens your published Profile Guide, using your brand color.",
    why: "QR codes bridge offline and online — customers scan from signage, packaging, or print materials without typing a URL.",
    examples:
      "Display this on screen for staff to show customers, download it for window decals, or include it on thank-you cards and review flyers.",
  },
} as const satisfies Record<string, ProfileGuideSectionTooltip>;
