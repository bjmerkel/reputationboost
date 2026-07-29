const { postWebhookEvent } = require("../lib/post-webhook");

const inputFields = [
  {
    key: "phone",
    label: "Customer phone",
    type: "string",
    helpText: "Map phone or email — at least one is required.",
  },
  { key: "email", label: "Customer email", type: "string" },
  { key: "source", label: "Source", type: "string", default: "twilio" },
];

module.exports = {
  key: "customer_opted_out",
  noun: "Customer",
  display: {
    label: "Update Customer",
    description:
      "Updates a customer to opted-out status. Future review requests are skipped.",
  },
  operation: {
    inputFields,
    perform: async (z, bundle) =>
      postWebhookEvent(z, bundle, {
        event: "customer.opted_out",
        phone: bundle.inputData.phone,
        email: bundle.inputData.email,
        optedOut: true,
        source: bundle.inputData.source || "twilio",
      }),
    sample: {
      id: "evt_sample",
      event: "customer.opted_out",
      phone: "214-555-0100",
      email: "jane@example.com",
      optedOut: true,
    },
  },
};
