import { personalizeReviewRequestSms } from "@/lib/sms/personalize";
import type { CustomerRecord } from "@/lib/customers/types";
import type { ServicePhraseLocation } from "@/lib/review-requests/service-phrase";

export interface ReviewEmailContent {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export function personalizeReviewEmailSubject(options: {
  subjectTemplate: string;
  customer: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">;
  businessName: string;
  focusKeyword?: string | null;
  location?: ServicePhraseLocation;
  neighborhoodLabel?: string | null;
}): string {
  const body = personalizeReviewRequestSms({
    template: options.subjectTemplate,
    customer: options.customer,
    businessName: options.businessName,
    reviewUrl: "",
    focusKeyword: options.focusKeyword,
    location: options.location,
    neighborhoodLabel: options.neighborhoodLabel,
  });
  return body.replace(/\s+/g, " ").trim();
}

export function buildReviewEmailContent(options: {
  subjectTemplate: string;
  bodyTemplate: string;
  customer: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">;
  businessName: string;
  reviewUrl: string;
  unsubscribeUrl: string;
  focusKeyword?: string | null;
  location?: ServicePhraseLocation;
  neighborhoodLabel?: string | null;
}): ReviewEmailContent {
  const bodyText = personalizeReviewRequestSms({
    template: options.bodyTemplate,
    customer: options.customer,
    businessName: options.businessName,
    reviewUrl: options.reviewUrl,
    focusKeyword: options.focusKeyword,
    location: options.location,
    neighborhoodLabel: options.neighborhoodLabel,
  });

  const subject = personalizeReviewEmailSubject({
    subjectTemplate: options.subjectTemplate,
    customer: options.customer,
    businessName: options.businessName,
    focusKeyword: options.focusKeyword,
    location: options.location,
    neighborhoodLabel: options.neighborhoodLabel,
  });

  const firstName =
    options.customer.first_name.trim() ||
    options.customer.last_name.trim() ||
    "there";

  const bodyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#202124;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f9fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dadce0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 8px;">
              <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#1a73e8;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(options.businessName)}</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#3c4043;">Hi ${escapeHtml(firstName)},</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3c4043;">${formatBodyHtml(bodyText, options.reviewUrl)}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:999px;background:#1a73e8;">
                    <a href="${escapeHtml(options.reviewUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Leave a Google review</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#80868b;">Or copy this link: <a href="${escapeHtml(options.reviewUrl)}" style="color:#1a73e8;word-break:break-all;">${escapeHtml(options.reviewUrl)}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #f1f3f4;background:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#80868b;">You received this because you recently worked with ${escapeHtml(options.businessName)}. <a href="${escapeHtml(options.unsubscribeUrl)}" style="color:#80868b;">Unsubscribe</a> from future review requests.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, bodyText, bodyHtml };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBodyHtml(bodyText: string, reviewUrl: string): string {
  const withoutLink = bodyText.replace(reviewUrl, "").trim();
  return escapeHtml(withoutLink).replace(/\n/g, "<br />");
}

export function previewReviewEmailContent(options: {
  subjectTemplate: string;
  bodyTemplate: string;
  businessName: string;
  reviewUrl: string;
  customer?: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes"> | null;
  focusKeyword?: string | null;
  location?: ServicePhraseLocation;
  neighborhoodLabel?: string | null;
}): ReviewEmailContent {
  const customer = options.customer ?? {
    first_name: "Alex",
    last_name: "Customer",
    service_notes: options.focusKeyword ?? "recent service",
  };

  return buildReviewEmailContent({
    ...options,
    customer,
    unsubscribeUrl: "https://example.com/unsubscribe",
  });
}
