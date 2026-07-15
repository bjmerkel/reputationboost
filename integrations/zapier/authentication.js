const testAuth = async (z, bundle) => {
  const url = bundle.authData.webhook_url;
  if (!url || !url.includes("/api/integrations/webhook")) {
    throw new z.errors.Error(
      "Paste your full Reputation Boost webhook URL from Customers → Connect your field service tool.",
      "AuthenticationError",
      401
    );
  }

  return { ok: true };
};

module.exports = {
  type: "custom",
  test: testAuth,
  connectionLabel: "{{bundle.authData.webhook_url}}",
  fields: [
    {
      key: "webhook_url",
      label: "Webhook URL",
      required: true,
      type: "string",
      helpText:
        "Copy this from Reputation Boost → Customers → Connect your field service tool (step 3). It looks like https://your-app.com/api/integrations/webhook?token=wb_...",
    },
  ],
};
