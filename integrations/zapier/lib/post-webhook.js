const postWebhookEvent = async (z, bundle, body) => {
  const payload = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

  const response = await z.request({
    url: bundle.authData.webhook_url,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new z.errors.Error(
      `Reputation Boost returned ${response.status}: ${JSON.stringify(response.data)}`,
      "InvalidData",
      response.status
    );
  }

  return response.data;
};

module.exports = { postWebhookEvent };
