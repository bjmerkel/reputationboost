const { postWebhookEvent } = require("../lib/post-webhook");
const { revenueInputFields, readRevenueFields } = require("../lib/revenue-fields");

const inputFields = [
  { key: "phone", label: "Customer phone", required: true, type: "string" },
  { key: "firstName", label: "First name", type: "string" },
  { key: "lastName", label: "Last name", type: "string" },
  { key: "service", label: "Service / line item", type: "string" },
  { key: "serviceDate", label: "Invoice date", type: "datetime" },
  { key: "externalId", label: "External invoice ID", type: "string" },
  ...revenueInputFields,
  { key: "source", label: "Source", type: "string", default: "zapier" },
  {
    key: "sendReviewRequest",
    label: "Send review request",
    type: "boolean",
    default: "true",
  },
];

module.exports = {
  key: "invoice_paid",
  noun: "Customer",
  display: {
    label: "Create Customer From Invoice",
    description:
      "Creates or updates a customer when an invoice is paid. Optionally queues an SMS review request.",
  },
  operation: {
    inputFields,
    perform: async (z, bundle) =>
      postWebhookEvent(z, bundle, {
        event: "invoice.paid",
        phone: bundle.inputData.phone,
        firstName: bundle.inputData.firstName,
        lastName: bundle.inputData.lastName,
        service: bundle.inputData.service,
        serviceDate: bundle.inputData.serviceDate,
        externalId: bundle.inputData.externalId,
        ...readRevenueFields(bundle),
        source: bundle.inputData.source || "zapier",
        sendReviewRequest: bundle.inputData.sendReviewRequest !== "false",
      }),
    sample: {
      id: "evt_sample",
      event: "invoice.paid",
      phone: "214-555-0100",
    },
  },
};
