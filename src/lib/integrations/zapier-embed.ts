export interface ZapierTemplateEmbed {
  id: string;
  label: string;
  description: string;
  createUrl: string;
  embedUrl: string | null;
}

export interface ZapierEmbedConfig {
  enabled: boolean;
  appSlug: string;
  appDirectoryUrl: string;
  createZapUrl: string;
  templates: ZapierTemplateEmbed[];
}

const TEMPLATE_ENV_KEYS: Record<string, string> = {
  "jobber-job-completed": "ZAPIER_TEMPLATE_JOBBER",
  "hcp-job-completed": "ZAPIER_TEMPLATE_HCP",
  "quickbooks-invoice-paid": "ZAPIER_TEMPLATE_QUICKBOOKS",
  "customer-opt-out": "ZAPIER_TEMPLATE_OPT_OUT",
};

const TEMPLATE_LABELS: Record<string, { label: string; description: string }> = {
  "jobber-job-completed": {
    label: "Jobber → Reputation Boost",
    description: "When a Jobber job is completed, send a review request.",
  },
  "hcp-job-completed": {
    label: "Housecall Pro → Reputation Boost",
    description: "When a Housecall Pro job finishes, send a review request.",
  },
  "quickbooks-invoice-paid": {
    label: "QuickBooks → Reputation Boost",
    description: "When a QuickBooks invoice is paid, send a review request.",
  },
  "customer-opt-out": {
    label: "SMS opt-out → Reputation Boost",
    description: "When a customer replies STOP, mark them opted out.",
  },
};

function readTemplateId(templateKey: string): string | null {
  const envKey = TEMPLATE_ENV_KEYS[templateKey];
  const value = process.env[envKey]?.trim();
  return value || null;
}

/**
 * Build a Partner Embed create URL with the user's webhook URL prefilled on the
 * Reputation Boost connection (step index 1 is typical for trigger → action Zaps).
 */
export function buildZapierEmbedUrl(
  appSlug: string,
  templateId: string,
  webhookUrl: string
): string {
  const base = `https://api.zapier.com/v1/embed/${appSlug}/create/${templateId}`;
  const params = new URLSearchParams();
  params.set("steps[1][params][webhook_url]", webhookUrl);
  return `${base}?${params.toString()}`;
}

export function buildZapierCreateZapUrl(appSlug: string): string {
  const params = new URLSearchParams({
    utm_source: "reputation_boost",
    utm_medium: "wizard",
    utm_campaign: "zapier_setup",
  });
  return `https://zapier.com/apps/${appSlug}/integrations?${params.toString()}`;
}

export function getZapierEmbedConfig(webhookUrl: string): ZapierEmbedConfig {
  const appSlug = process.env.ZAPIER_APP_SLUG?.trim() || "reputation-boost";
  const templates: ZapierTemplateEmbed[] = [];

  for (const [id, meta] of Object.entries(TEMPLATE_LABELS)) {
    const templateId = readTemplateId(id);
    if (!templateId) continue;

    const createUrl = buildZapierEmbedUrl(appSlug, templateId, webhookUrl);
    templates.push({
      id,
      label: meta.label,
      description: meta.description,
      createUrl,
      embedUrl: createUrl,
    });
  }

  return {
    enabled: templates.length > 0,
    appSlug,
    appDirectoryUrl: buildZapierCreateZapUrl(appSlug),
    createZapUrl: buildZapierCreateZapUrl(appSlug),
    templates,
  };
}
