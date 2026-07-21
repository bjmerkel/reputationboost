export interface ZapierTemplate {
  id: string;
  label: string;
  description: string;
  templateUrl: string;
  eventType: string;
  sampleFields: string[];
}

export const ZAPIER_TEMPLATES: ZapierTemplate[] = [
  {
    id: "jobber-job-completed",
    label: "Jobber — Job Completed",
    description: "Send a review request when a Jobber job is marked complete.",
    templateUrl: "https://zapier.com/apps/jobber/integrations/reputation-boost",
    eventType: "job.completed",
    sampleFields: ["phone", "firstName", "lastName", "jobType", "service", "jobAddress", "jobCity", "jobZip", "lineItems", "externalId"],
  },
  {
    id: "hcp-job-completed",
    label: "Housecall Pro — Job Completed",
    description: "Trigger outreach when a Housecall Pro job finishes.",
    templateUrl: "https://zapier.com/apps/housecall-pro/integrations/reputation-boost",
    eventType: "job.completed",
    sampleFields: ["phone", "name", "service", "jobAddress", "jobCity", "jobZip", "externalId"],
  },
  {
    id: "quickbooks-invoice-paid",
    label: "QuickBooks — Invoice Paid",
    description: "Request a review after a QuickBooks invoice is paid.",
    templateUrl: "https://zapier.com/apps/quickbooks-online/integrations/reputation-boost",
    eventType: "invoice.paid",
    sampleFields: ["phone", "name", "service", "externalId"],
  },
  {
    id: "customer-opt-out",
    label: "SMS opt-out handler",
    description: "Mark a customer as opted out when they reply STOP or unsubscribe.",
    templateUrl: "https://zapier.com/apps/twilio/integrations/reputation-boost",
    eventType: "customer.opted_out",
    sampleFields: ["phone", "optedOut"],
  },
];

export const ZAPIER_SETUP_STEPS = [
  "Pick a Zapier template below (or build your own with Webhooks by Zapier → POST).",
  "Paste your Reputation Boost webhook URL into the Zap action.",
  "Map customer phone, name, and Jobber job type / line item into service or jobType fields.",
  "Map the job site address into jobAddress, jobCity, and jobZip so review requests can target weak map areas.",
  "Set event to job.completed or invoice.paid for review requests.",
  "Use customer.opted_out with optedOut: true to honor unsubscribe requests.",
];
