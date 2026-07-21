const { postWebhookEvent } = require("../lib/post-webhook");

const inputFields = [
  { key: "phone", label: "Customer phone", required: true, type: "string" },
  { key: "firstName", label: "First name", type: "string" },
  { key: "lastName", label: "Last name", type: "string" },
  { key: "service", label: "Service / job type", type: "string" },
  { key: "jobAddress", label: "Job site address", type: "string" },
  { key: "jobCity", label: "Job city", type: "string" },
  { key: "jobZip", label: "Job ZIP code", type: "string" },
  { key: "jobLat", label: "Job latitude", type: "number" },
  { key: "jobLng", label: "Job longitude", type: "number" },
  { key: "serviceDate", label: "Service date", type: "datetime" },
  { key: "externalId", label: "External job ID", type: "string" },
  { key: "source", label: "Source", type: "string", default: "zapier" },
  {
    key: "sendReviewRequest",
    label: "Send review request",
    type: "boolean",
    default: "true",
    helpText: "Queue an SMS review request when this event is received.",
  },
];

module.exports = {
  key: "job_completed",
  noun: "Job",
  display: {
    label: "Job Completed",
    description: "Add a customer and optionally send a review request when a job finishes.",
  },
  operation: {
    inputFields,
    perform: async (z, bundle) =>
      postWebhookEvent(z, bundle, {
        event: "job.completed",
        phone: bundle.inputData.phone,
        firstName: bundle.inputData.firstName,
        lastName: bundle.inputData.lastName,
        service: bundle.inputData.service,
        jobAddress: bundle.inputData.jobAddress,
        jobCity: bundle.inputData.jobCity,
        jobZip: bundle.inputData.jobZip,
        jobLat: bundle.inputData.jobLat,
        jobLng: bundle.inputData.jobLng,
        serviceDate: bundle.inputData.serviceDate,
        externalId: bundle.inputData.externalId,
        source: bundle.inputData.source || "zapier",
        sendReviewRequest: bundle.inputData.sendReviewRequest !== "false",
      }),
    sample: {
      id: "evt_sample",
      event: "job.completed",
      phone: "214-555-0100",
    },
  },
};
