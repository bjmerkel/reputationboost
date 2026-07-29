const { postWebhookEvent } = require("../lib/post-webhook");
const { revenueInputFields, readRevenueFields } = require("../lib/revenue-fields");

const inputFields = [
  {
    key: "phone",
    label: "Customer phone",
    type: "string",
    helpText:
      "Required for SMS review requests unless email is mapped.",
  },
  {
    key: "name",
    label: "Customer name",
    type: "string",
    helpText: "Full customer or display name (optional if first and last name are mapped).",
  },
  { key: "firstName", label: "First name", type: "string" },
  { key: "lastName", label: "Last name", type: "string" },
  { key: "email", label: "Customer email", type: "string" },
  {
    key: "service",
    label: "Service / line item",
    type: "string",
    helpText: "Invoice line description or product/service name.",
  },
  { key: "serviceDate", label: "Invoice or payment date", type: "datetime" },
  { key: "externalId", label: "External invoice or payment ID", type: "string" },
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
      "Creates or updates a customer when an invoice is paid. Optionally queues a review request.",
  },
  operation: {
    inputFields,
    perform: async (z, bundle) =>
      postWebhookEvent(z, bundle, {
        event: "invoice.paid",
        phone: bundle.inputData.phone,
        name: bundle.inputData.name,
        firstName: bundle.inputData.firstName,
        lastName: bundle.inputData.lastName,
        email: bundle.inputData.email,
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
      name: "Jane Doe",
    },
  },
};
