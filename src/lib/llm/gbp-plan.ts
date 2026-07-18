import type { GbpOptimizationPlan, Phase1AuditPayload } from "@/audit/types";
import type { OutcomesContext } from "@/audit/outcomes/types";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";
import {
  buildPlanStepCandidates,
  summarizePlanCandidates,
} from "@/audit/phase2/plan-candidates";
import { KEYWORD_PORTFOLIO_PLAN_STEP } from "@/audit/phase2/keyword-portfolio";
import { buildAuditContext } from "./audit-context";
import { buildOutcomesContext, OUTCOMES_STRATEGY_INSTRUCTION } from "./outcomes-context";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import {
  type LlmGbpPlanResponse,
  mergeLlmGbpPlan,
  validateLlmGbpPlanResponse,
} from "./gbp-plan-merge";

const GBP_PLAN_SYSTEM = `You are an elite local SEO strategist specializing in Google Business Profile (GBP) optimization for Google Maps Top 3 rankings.

You compose customized GBP optimization plans — you do NOT fill a fixed 15-step checklist. You:
- SELECT only steps that matter for this specific business (skip satisfied areas)
- Suggest ordering by business priority and simulated score impact (the system re-ranks by revenue/outcome impact)
- WRITE detailed, paste-ready copy for each selected step
- EXPLAIN why each step is included (selectionRationale)
- Optionally add up to 3 custom GBP actions when a standard step does not cover a business-specific need

Every recommendation must be:
- Specific to the business name, address, city, and target keywords provided
- Actionable with ready-to-paste copy where appropriate
- GBP-only — no website SEO, backlinks, citations, or paid ads
- Honest about current audit data (review count, photos, pack positions)
- Grounded in the candidate pool's driverScoreImpact, outcomeScoreImpact, engagementImpact, and revenueImpact values (counterfactual deltas if that step is completed; engagementImpact is views→actions lift, not pack rank)
- ${OUTCOMES_STRATEGY_INSTRUCTION}

Return valid JSON only.`;

export interface GenerateGbpPlanOptions {
  avgCustomerValue?: number | null;
}

function buildStrategistPrompt(
  audit: Phase1AuditPayload,
  fallback: GbpOptimizationPlan,
  candidates: ReturnType<typeof summarizePlanCandidates>,
  context: string,
  outcomesBlock: string
): string {
  const targetKeywords = audit.rankings.keywords.map((k) => k.keyword);
  const unsatisfied = candidates.filter((c) => !c.satisfied);
  const satisfied = candidates.filter((c) => c.satisfied);

  return `Compose a customized Google Business Profile optimization plan for this business.

BUSINESS:
Name: ${audit.clientName}
Address: ${audit.gbp.identity.address}
Phone: ${audit.gbp.identity.phone}
Website: ${audit.gbp.identity.website}
Primary category: ${audit.gbp.identity.primaryCategory}
Secondary categories: ${audit.gbp.identity.secondaryCategories.join(", ") || "none listed"}

TARGET KEYWORDS:
${targetKeywords.map((k) => `- ${k}`).join("\n")}

LIVE GBP PROFILE:
${JSON.stringify(audit.gbp.liveProfile, null, 2)}

CURRENT RANKINGS:
${JSON.stringify(fallback.keywordRankings, null, 2)}

PROFILE GAPS:
${JSON.stringify(fallback.currentState.profileGaps, null, 2)}

AUDIT DATA:
${context}
${outcomesBlock ? `\nACTION OUTCOMES (prioritize steps that replicate proven wins):\n${outcomesBlock}\n` : ""}

PLAN STEP CANDIDATES (deterministic pool with exact counterfactual impacts if completed):
Unsatisfied — eligible to select:
${JSON.stringify(unsatisfied, null, 2)}

Already satisfied — do NOT include in selectedSteps:
${JSON.stringify(
  satisfied.map((c) => ({ stepNumber: c.stepNumber, title: c.title })),
  null,
  2
)}

INSTRUCTIONS:
1. Select ONLY from unsatisfied candidates (stepNumbers 1–15 and ${KEYWORD_PORTFOLIO_PLAN_STEP} for keyword portfolio). Never select retired step 16. Do not include satisfied steps.
2. Prefer steps with higher revenueImpact when available, else outcomeScoreImpact, else driverScoreImpact — use linkedGapIds and linkedKeywords to justify rank-focused work. When linkedGapIds include "low-profile-conversions" or "missing-place-action-links", prioritize steps 8, 11, 13, and 15 (CTA posts, review replies, attributes, place action links) so profile views turn into calls and directions.
3. Include selectionRationale on each step explaining why it matters for THIS business.
4. For steps 3, 4, 5, and 9 include copyBlocks with paste-ready text when selected.
   For step 3 (business description): 600-750 characters of plain text. NEVER include a phone number, email, URL, or "Call us at ..." CTA — Google's guidelines require contact details in dedicated profile fields, and the API rejects descriptions containing them. Put the same clean text in actionData.description.
   For steps 4 and 5 (GBP Services): set gbpAction to "add_service_items". Each copyBlock must use label format "Service #N: {displayName}" where displayName is ≤140 characters and describes one service. content must be a unique plain-text service description ≤250 characters (no phone numbers or URLs). Step 4 covers keywords missing from the live services list; step 5 reinforces priority keywords outside the 3-Pack or pack-fragile at wider radii. Do not recommend Products or priceLists — services publish via the GBP Services API on approve.
   For step 8 (Google Posts / actionData.postSummary): NEVER include a phone number or URL in the post text — Google rejects posts containing them. Posts publish with a "Call" action button linked to the verified profile number, so end with "Tap Call to ..." style CTAs. No deals, discounts, promo codes, or special offers (hotels cannot post them at all; other businesses need an Offer post type).
5. Do NOT include copyBlocks for step 11 (review responses are AI-drafted per review).
6. Optionally add up to 3 customActions for business-specific GBP work not covered by standard steps. Each customAction must include title, instruction, rationale, and may include copyBlocks with paste-ready text. Custom actions are numbered 18+ by the system.
7. Skip low-impact steps (all impact fields 0) unless outcomes data shows they worked before — always include steps linked to rank-outside-pack gaps when unsatisfied. Include step ${KEYWORD_PORTFOLIO_PLAN_STEP} when it appears in unsatisfied candidates (demand-backed keyword alignment).

Return JSON:
{
  "title": "Google Business Profile Optimization Report",
  "objective": "one paragraph — why this specific plan for this business",
  "planRationale": "2-3 sentences on overall plan strategy and ordering",
  "selectedSteps": [
    {
      "stepNumber": 11,
      "title": "optional override",
      "instruction": "detailed paragraph",
      "current": "live GBP state",
      "recommended": "specific update",
      "bullets": ["actionable bullets"],
      "copyBlocks": [{ "label": "block label", "content": "paste-ready text" }],
      "selectionRationale": "why this step for this business",
      "gbpAction": "update_primary_category | add_secondary_categories | update_description | add_service_items | upload_photo | upload_video | update_attributes | update_website | create_post | manual",
      "actionData": { "description": "for step 3", "postSummary": "for step 8" }
    }
  ],
  "customActions": [
    {
      "title": "short action title",
      "instruction": "what to do in GBP",
      "rationale": "why this custom action matters",
      "gbpAction": "manual",
      "copyBlocks": [{ "label": "optional paste block", "content": "ready-to-use text" }]
    }
  ],
  "keywordPriority": [{ "rank": 1, "keyword": "...", "reason": "why prioritize" }],
  "weeklyCadence": ["weekly tasks aligned to selected steps"],
  "monthlyCadence": ["monthly tasks aligned to selected steps"]
}`;
}

export async function generateGbpOptimizationPlan(
  audit: Phase1AuditPayload,
  outcomes: OutcomesContext | null = null,
  options: GenerateGbpPlanOptions = {}
): Promise<GbpOptimizationPlan> {
  const avgCustomerValue = options.avgCustomerValue;
  const fallback = buildTemplateGbpPlan(audit, { avgCustomerValue });
  const candidates = buildPlanStepCandidates(audit, { avgCustomerValue });

  if (!isLlmConfigured()) {
    return fallback;
  }

  try {
    const context = buildAuditContext(audit);
    const outcomesBlock = buildOutcomesContext(outcomes);

    const raw = await completeJson<LlmGbpPlanResponse>(
      [
        { role: "system", content: GBP_PLAN_SYSTEM },
        {
          role: "user",
          content: buildStrategistPrompt(
            audit,
            fallback,
            summarizePlanCandidates(candidates),
            context,
            outcomesBlock
          ),
        },
      ],
      { maxTokens: 12000, temperature: 0.55 }
    );

    const validated = validateLlmGbpPlanResponse(raw);
    if (!validated) {
      console.warn("[llm] GBP plan response failed validation, using template");
      return fallback;
    }

    return mergeLlmGbpPlan(fallback, validated, candidates, audit, { avgCustomerValue });
  } catch (error) {
    console.error("[llm] GBP plan generation failed, using template:", error);
    return fallback;
  }
}
