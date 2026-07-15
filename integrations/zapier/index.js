const authentication = require("./authentication");
const jobCompletedCreate = require("./creates/job_completed");
const invoicePaidCreate = require("./creates/invoice_paid");
const customerOptedOutCreate = require("./creates/customer_opted_out");

module.exports = {
  version: require("./package.json").version,
  platformVersion: require("zapier-platform-core").version,
  authentication,
  creates: {
    [jobCompletedCreate.key]: jobCompletedCreate,
    [invoicePaidCreate.key]: invoicePaidCreate,
    [customerOptedOutCreate.key]: customerOptedOutCreate,
  },
};
