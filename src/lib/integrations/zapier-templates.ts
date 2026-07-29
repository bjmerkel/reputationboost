export interface ZapierTemplate {
  id: string;
  label: string;
  description: string;
  templateUrl: string;
  eventType: string;
  sampleFields: string[];
}

/** Contact fields included in every Zapier integration mapping guide. */
export const ZAPIER_CONTACT_FIELDS = ["phone", "email"] as const;

export function withZapierContactFields(fields: readonly string[]): string[] {
  const rest = fields.filter((field) => field !== "phone" && field !== "email");
  return [...ZAPIER_CONTACT_FIELDS, ...rest];
}

export const ZAPIER_TEMPLATES: ZapierTemplate[] = [
  {
    id: "jobber-job-completed",
    label: "Jobber — Job Completed",
    description: "Send a review request when a Jobber job is marked complete.",
    templateUrl: "https://zapier.com/apps/jobber/integrations/reputation-boost",
    eventType: "job.completed",
    sampleFields: withZapierContactFields([
      "firstName",
      "lastName",
      "jobType",
      "service",
      "jobAddress",
      "jobCity",
      "jobZip",
      "lineItems",
      "externalId",
      "amount",
      "currency",
    ]),
  },
  {
    id: "hcp-job-completed",
    label: "Housecall Pro — Job Completed",
    description: "Trigger outreach when a Housecall Pro job finishes.",
    templateUrl: "https://zapier.com/apps/housecall-pro/integrations/reputation-boost",
    eventType: "job.completed",
    sampleFields: withZapierContactFields([
      "name",
      "service",
      "jobAddress",
      "jobCity",
      "jobZip",
      "externalId",
      "amount",
      "currency",
    ]),
  },
  {
    id: "square-payment-received",
    label: "Square — Payment Received",
    description: "Request a review after a Square payment is completed.",
    templateUrl: "https://zapier.com/apps/square/integrations/reputation-boost",
    eventType: "invoice.paid",
    sampleFields: withZapierContactFields([
      "name",
      "service",
      "externalId",
      "amount",
      "currency",
      "paidAt",
    ]),
  },
];

export const ZAPIER_SETUP_STEPS = [
  "Pick a Zapier template below (or build your own with Webhooks by Zapier → POST).",
  "Paste your Reputation Boost webhook URL into the Zap action.",
  "Map customer phone and email when available — at least one is required. Smart mode sends both SMS and email when both are on file.",
  "Map Jobber job type / line item into service or jobType fields.",
  "Map invoice or job total into amount (and currency when available) for revenue attribution.",
  "Map the job site address into jobAddress, jobCity, and jobZip so review requests can target weak map areas.",
  "Set event to job.completed or invoice.paid for review requests.",
];
