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

const TRIGGER_APP_SLUGS: Record<string, string> = {
  "jobber-job-completed": "jobber",
  "hcp-job-completed": "housecall-pro",
  "quickbooks-invoice-paid": "quickbooks-online",
  "customer-opt-out": "twilio",
  custom: "webhook",
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

const UTM_PARAMS = {
  utm_source: "reputation_boost",
  utm_medium: "wizard",
  utm_campaign: "zapier_setup",
} as const;

function readTemplateId(templateKey: string): string | null {
  const envKey = TEMPLATE_ENV_KEYS[templateKey];
  const value = process.env[envKey]?.trim();
  return value || null;
}

function withUtm(base: string): string {
  const params = new URLSearchParams(UTM_PARAMS);
  return `${base}?${params.toString()}`;
}

/**
 * Partner Embed create URL with the user's webhook URL prefilled.
 */
export function buildZapierEmbedUrl(
  appSlug: string,
  templateId: string,
  webhookUrl: string
): string {
  const base = `https://api.zapier.com/v1/embed/${appSlug}/create/${templateId}`;
  const params = new URLSearchParams(UTM_PARAMS);
  params.set("steps[1][params][webhook_url]", webhookUrl);
  return `${base}?${params.toString()}`;
}

/** Opens Zapier editor to create a new Zap (better than the app directory page). */
export function buildZapierWebIntentUrl(): string {
  return withUtm("https://zapier.com/webintent/create-zap");
}

/** App pair page, e.g. Jobber integrations that connect to Reputation Boost. */
export function buildZapierPairUrl(triggerAppSlug: string, actionAppSlug: string): string {
  return withUtm(`https://zapier.com/apps/${triggerAppSlug}/integrations/${actionAppSlug}`);
}

export function buildZapierSetupUrl(
  templateId: string,
  appSlug: string,
  webhookUrl: string,
  publishedTemplateId?: string | null
): string {
  if (publishedTemplateId) {
    return buildZapierEmbedUrl(appSlug, publishedTemplateId, webhookUrl);
  }

  const triggerSlug = TRIGGER_APP_SLUGS[templateId];
  if (triggerSlug && templateId !== "custom") {
    return buildZapierPairUrl(triggerSlug, appSlug);
  }

  return buildZapierWebIntentUrl();
}

export function buildZapierCreateZapUrl(appSlug: string): string {
  return buildZapierWebIntentUrl();
}

export function getZapierEmbedConfig(webhookUrl: string): ZapierEmbedConfig {
  const appSlug = process.env.ZAPIER_APP_SLUG?.trim() || "reputation-boost";
  const templates: ZapierTemplateEmbed[] = [];

  for (const [id, meta] of Object.entries(TEMPLATE_LABELS)) {
    const publishedTemplateId = readTemplateId(id);
    const createUrl = buildZapierSetupUrl(id, appSlug, webhookUrl, publishedTemplateId);

    templates.push({
      id,
      label: meta.label,
      description: meta.description,
      createUrl,
      embedUrl: publishedTemplateId ? createUrl : null,
    });
  }

  return {
    enabled: templates.some((template) => template.embedUrl !== null),
    appSlug,
    appDirectoryUrl: withUtm(`https://zapier.com/apps/${appSlug}/integrations`),
    createZapUrl: buildZapierWebIntentUrl(),
    templates,
  };
}
