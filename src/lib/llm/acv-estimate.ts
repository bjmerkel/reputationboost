import type { FullAuditPayload } from "@/audit/types";
import {
  acvDefaultInputFromAudit,
  estimateTemplateAcv,
  parseLocationFromAddress,
} from "@/lib/business/acv-defaults";
import { acvEstimateRationale, resolveAcvCopy } from "@/lib/business/acv-copy";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";

export { parseLocationFromAddress };

const ACV_ESTIMATE_SYSTEM = `You estimate typical average customer value (ACV) for local businesses in the United States.

ACV means the average revenue from one converted customer or completed job — not lifetime value.

Rules:
- Return a single typical transaction/job value in USD (whole dollars)
- Adjust for the business category and local market (city/state cost of living when known)
- Use business name, category, industry, and keywords together — generic categories like "Services" should be inferred from the name and keywords
- Use realistic national benchmarks, then adjust for market:
  • Pool service/repair: $600–950
  • Plumber/HVAC/electrician: $350–800
  • Roofing/remodeling: $5,000–15,000
  • Restaurant/cafe: $35–70 per order
  • Salon/spa/grooming: $60–160 per visit
  • Dentist/medical: $250–650 per visit
  • Legal: $1,200–3,000 per case
  • Retail: $50–250 per sale
  • Generic local services: $400–700 unless clearly lower-ticket
- In high-cost metros (SF Bay Area, NYC, LA, Boston, Seattle), add roughly 10–25%
- In lower-cost states (MS, AL, AR, WV, OK, LA), subtract roughly 5–10%
- Be realistic — owners can edit the number, but avoid systematically low defaults for trades and home services
- Do not invent business-specific facts

Return valid JSON only:
{
  "avgCustomerValue": number,
  "confidence": "low" | "medium" | "high",
  "rationale": "one short sentence"
}`;

export type AcvEstimateConfidence = "low" | "medium" | "high";

export interface AcvEstimateContext {
  businessName: string;
  primaryCategory: string;
  industry?: string | null;
  city: string;
  state: string;
  keywords?: string[];
}

export interface AcvEstimateResult {
  avgCustomerValue: number;
  confidence: AcvEstimateConfidence;
  rationale: string;
  source: "llm" | "template";
}

export function buildAcvEstimateContext(
  audit: FullAuditPayload,
  industry?: string | null
): AcvEstimateContext {
  const input = acvDefaultInputFromAudit(audit, industry);
  return {
    businessName: input.businessName ?? audit.clientName,
    primaryCategory: input.primaryCategory || industry || "local business",
    industry: input.industry ?? input.primaryCategory ?? null,
    city: input.city ?? "",
    state: input.state ?? "",
    keywords: input.keywords ?? [],
  };
}

function templateAcvEstimate(context: AcvEstimateContext): AcvEstimateResult {
  const category = context.primaryCategory || context.businessName || "local business";
  const avgCustomerValue = estimateTemplateAcv({
    businessName: context.businessName,
    primaryCategory: context.primaryCategory,
    industry: context.industry,
    city: context.city,
    state: context.state,
    keywords: context.keywords,
  });
  const copy = resolveAcvCopy(context.primaryCategory || context.industry || context.businessName);

  const locationLabel =
    context.city && context.state
      ? ` in ${context.city}, ${context.state}`
      : context.city
        ? ` in ${context.city}`
        : "";

  return {
    avgCustomerValue,
    confidence: "low",
    rationale: acvEstimateRationale(copy, category, locationLabel, avgCustomerValue),
    source: "template",
  };
}

function normalizeEstimate(raw: unknown, fallback: AcvEstimateResult): AcvEstimateResult {
  if (!raw || typeof raw !== "object") return fallback;

  const value = Number((raw as { avgCustomerValue?: unknown }).avgCustomerValue);
  if (!Number.isFinite(value) || value < 25 || value > 50_000) return fallback;

  const confidenceRaw = (raw as { confidence?: unknown }).confidence;
  const confidence: AcvEstimateConfidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : fallback.confidence;

  const rationale =
    typeof (raw as { rationale?: unknown }).rationale === "string" &&
    (raw as { rationale: string }).rationale.trim()
      ? (raw as { rationale: string }).rationale.trim()
      : fallback.rationale;

  return {
    avgCustomerValue: Math.round(value),
    confidence,
    rationale,
    source: "llm",
  };
}

export async function estimateAverageCustomerValue(
  context: AcvEstimateContext
): Promise<AcvEstimateResult> {
  const fallback = templateAcvEstimate(context);

  if (!isLlmConfigured()) {
    return fallback;
  }

  const locationLine =
    context.city || context.state
      ? `Location: ${[context.city, context.state].filter(Boolean).join(", ")}`
      : "Location: unknown (use national category averages)";

  const keywordLine =
    context.keywords && context.keywords.length > 0
      ? `Tracked keywords: ${context.keywords.slice(0, 8).join(", ")}`
      : "Tracked keywords: none";

  try {
    const llm = await completeJson<{
      avgCustomerValue?: unknown;
      confidence?: unknown;
      rationale?: unknown;
    }>(
      [
        { role: "system", content: ACV_ESTIMATE_SYSTEM },
        {
          role: "user",
          content: `Estimate average customer value for this local business.

Business: ${context.businessName}
Primary category: ${context.primaryCategory}
Industry: ${context.industry || context.primaryCategory}
${locationLine}
${keywordLine}

Return JSON with avgCustomerValue (USD whole dollars), confidence, and rationale.`,
        },
      ],
      { temperature: 0.3, maxTokens: 250 }
    );

    return normalizeEstimate(llm, fallback);
  } catch (error) {
    console.error("[llm] ACV estimate failed:", error);
    return fallback;
  }
}
