import QRCode from "qrcode";
import type { ProfileGuideFlyerTemplate } from "./theme";

export interface FlyerInput {
  businessName: string;
  tagline?: string | null;
  primaryColor: string;
  backgroundColor: string;
  publicUrl: string;
  phone?: string | null;
  template: ProfileGuideFlyerTemplate;
}

const TEMPLATE_COPY: Record<
  ProfileGuideFlyerTemplate,
  { headline: string; subhead: string; cta: string }
> = {
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

export async function buildProfileGuideFlyerHtml(input: FlyerInput): Promise<string> {
  const copy = TEMPLATE_COPY[input.template];
  const qrDataUrl = await QRCode.toDataURL(`${input.publicUrl}?src=flyer-${input.template}`, {
    width: 280,
    margin: 1,
    color: {
      dark: input.primaryColor,
      light: "#ffffff",
    },
  });

  const headingFont =
    input.template === "bold"
      ? "Impact, 'Arial Black', sans-serif"
      : input.template === "friendly"
        ? "'Trebuchet MS', sans-serif"
        : "Georgia, serif";

  const bodyFont =
    input.template === "bold"
      ? "Arial, Helvetica, sans-serif"
      : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.businessName)} — Review Flyer</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body {
      margin: 0;
      font-family: ${bodyFont};
      background: ${input.backgroundColor};
      color: #202124;
    }
    .flyer {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 48px;
      text-align: center;
      border: 6px solid ${input.primaryColor};
      border-radius: ${input.template === "bold" ? "8px" : "24px"};
      background: white;
    }
    .badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 999px;
      background: ${input.primaryColor};
      color: white;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 24px 0 8px;
      font-family: ${headingFont};
      font-size: ${input.template === "bold" ? "48px" : "36px"};
      color: ${input.primaryColor};
      line-height: 1.1;
    }
    .subhead {
      font-size: 20px;
      color: #5f6368;
      margin: 0 0 24px;
    }
    .qr {
      width: 280px;
      height: 280px;
      margin: 0 auto 24px;
    }
    .stars {
      font-size: 28px;
      letter-spacing: 4px;
      color: #f9ab00;
      margin-bottom: 16px;
    }
    .cta {
      font-size: 16px;
      color: #3c4043;
      margin-bottom: 24px;
    }
    .footer {
      font-size: 14px;
      color: #80868b;
    }
  </style>
</head>
<body>
  <div class="flyer">
    <span class="badge">${escapeHtml(input.businessName)}</span>
    <h1>${escapeHtml(copy.headline)}</h1>
    <p class="subhead">${escapeHtml(input.tagline?.trim() || copy.subhead)}</p>
    <img class="qr" src="${qrDataUrl}" alt="QR code to ${escapeHtml(input.businessName)} Profile Guide" />
    <div class="stars">★★★★★</div>
    <p class="cta">${escapeHtml(copy.cta)}</p>
    <p class="footer">${escapeHtml(input.phone?.trim() || input.publicUrl)}</p>
  </div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
