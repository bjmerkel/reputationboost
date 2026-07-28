const { postWebhookEvent } = require("../lib/post-webhook");

const inputFields = [
  { key: "phone", label: "Customer phone", required: true, type: "string" },
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
        optedOut: true,
        source: bundle.inputData.source || "twilio",
      }),
    sample: {
      id: "evt_sample",
      event: "customer.opted_out",
      phone: "214-555-0100",
      optedOut: true,
    },
  },
};
