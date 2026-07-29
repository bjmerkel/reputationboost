#!/usr/bin/env node
/**
 * Print Partner Embed URLs for each wizard template.
 * Usage: node scripts/print-embed-urls.js <webhook-url> [template-id]
 *
 * After creating a public Zap template in Zapier Partner, set the returned ID in Vercel:
 * ZAPIER_TEMPLATE_JOBBER, ZAPIER_TEMPLATE_HCP, ZAPIER_TEMPLATE_SQUARE
 */

const TEMPLATES = [
  { key: "jobber-job-completed", env: "ZAPIER_TEMPLATE_JOBBER", trigger: "Jobber — Job Completed" },
  { key: "hcp-job-completed", env: "ZAPIER_TEMPLATE_HCP", trigger: "Housecall Pro — Job Completed" },
  {
    key: "square-payment-received",
    env: "ZAPIER_TEMPLATE_SQUARE",
    trigger: "Square — New Payment",
  },
];

const APP_SLUG = process.env.ZAPIER_APP_SLUG || "reputation-boost";
const UTM = "utm_source=reputation_boost&utm_medium=wizard&utm_campaign=zapier_setup";

function buildEmbedUrl(appSlug, templateId, webhookUrl) {
  const params = new URLSearchParams(UTM);
  params.set("steps[1][params][webhook_url]", webhookUrl);
  return `https://api.zapier.com/v1/embed/${appSlug}/create/${templateId}?${params.toString()}`;
}

const webhookUrl = process.argv[2];
const onlyTemplate = process.argv[3];

if (!webhookUrl) {
  console.error("Usage: node scripts/print-embed-urls.js <webhook-url> [template-id]");
  process.exit(1);
}

const selected = onlyTemplate
  ? TEMPLATES.filter((template) => template.key === onlyTemplate)
  : TEMPLATES;

if (selected.length === 0) {
  console.error(`Unknown template: ${onlyTemplate}`);
  process.exit(1);
}

console.log(`App slug: ${APP_SLUG}`);
console.log(`Webhook URL: ${webhookUrl}\n`);

for (const template of selected) {
  console.log(`## ${template.key}`);
  console.log(`Trigger: ${template.trigger}`);
  console.log(`Env var: ${template.env}=<published-zap-template-id>`);
  console.log(`Action: Reputation Boost (step 1) — paste webhook_url in app connection`);
  console.log(
    `Example embed (replace TEMPLATE_ID after publishing): ${buildEmbedUrl(APP_SLUG, "TEMPLATE_ID", webhookUrl)}`
  );
  console.log("");
}
