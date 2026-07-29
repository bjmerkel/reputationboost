const revenueInputFields = [
  {
    key: "amount",
    label: "Job or invoice amount",
    type: "number",
    helpText: "Optional. Used for revenue attribution and keyword value estimates.",
  },
  {
    key: "currency",
    label: "Currency",
    type: "string",
    default: "USD",
    helpText: "ISO currency code, e.g. USD.",
  },
  {
    key: "paidAt",
    label: "Payment date",
    type: "datetime",
    helpText: "Optional. When the invoice was paid (invoice events).",
  },
];

function readRevenueFields(bundle) {
  const amount = bundle.inputData.amount;
  return {
    ...(amount !== undefined && amount !== null && amount !== "" ? { amount } : {}),
    ...(bundle.inputData.currency ? { currency: bundle.inputData.currency } : {}),
    ...(bundle.inputData.paidAt ? { paidAt: bundle.inputData.paidAt } : {}),
  };
}

module.exports = { revenueInputFields, readRevenueFields };
