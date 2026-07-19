import type { FullAuditPayload } from "@/audit/types";
import { defaultAcvPreviewHint } from "@/components/plan/plan-viewport";
import { acvEstimateRationale, resolveAcvCopy } from "@/lib/business/acv-copy";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";

const ACV_ESTIMATE_SYSTEM = `You estimate typical average customer value (ACV) for local businesses in the United States.

ACV means the average revenue from one converted customer or completed job — not lifetime value.

Rules:
- Return a single typical transaction/job value in USD (whole dollars)
- Adjust for the business category and local market (city/state cost of living when known)
- Use realistic ranges: retail/cafes often $25–150, salons $60–200, home services $200–800, legal/dental/medical often $300–2000+
- If location is unknown, use national averages for the category
- Be conservative — a rough estimate the owner can edit is better than an inflated number
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
}

export interface AcvEstimateResult {
  avgCustomerValue: number;
  confidence: AcvEstimateConfidence;
  rationale: string;
  source: "llm" | "template";
}

export function parseLocationFromAddress(address: string): { city: string; state: string } {
  const addressParts = address.split(",").map((part) => part.trim());
  const city = addressParts[1] ?? "";
  const state = addressParts[2]?.split(/\s+/)[0] ?? "";
  return { city, state };
}

export function buildAcvEstimateContext(
  audit: FullAuditPayload,
  industry?: string | null
): AcvEstimateContext {
  const { city, state } = parseLocationFromAddress(audit.gbp.identity.address);
  return {
    businessName: audit.clientName,
    primaryCategory: audit.gbp.identity.primaryCategory || industry || "local business",
    industry: industry ?? audit.gbp.identity.primaryCategory ?? null,
    city,
    state,
  };
}

function templateAcvEstimate(context: AcvEstimateContext): AcvEstimateResult {
  const category = context.primaryCategory || context.businessName || "local business";
  const auditLike = {
    gbp: { identity: { primaryCategory: context.primaryCategory } },
    clientName: context.businessName,
  } as FullAuditPayload;
  const avgCustomerValue = defaultAcvPreviewHint(auditLike);
  const copy = resolveAcvCopy(context.primaryCategory || context.industry);

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
