import type { GbpOptimizationPlan, GbpPlanStep, Phase1AuditPayload } from "@/audit/types";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";
import { buildAuditContext } from "./audit-context";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";

const GBP_PLAN_SYSTEM = `You are an elite local SEO consultant specializing exclusively in Google Business Profile (GBP) optimization for Google Maps Top 3 rankings.

Write detailed, step-by-step GBP optimization reports. Every recommendation must be:
- Specific to the business name, address, city, and target keywords provided
- Actionable with ready-to-paste copy (descriptions, services, Q&A, review response templates)
- GBP-only — do NOT include website SEO, backlinks, citations, or paid ads
- Honest about current audit data (review count, photos, pack positions)

Return valid JSON only. Be comprehensive — each step should have enough detail that the owner can execute without guessing.`;

interface LlmGbpPlanResponse {
  title: string;
  objective: string;
  steps: Array<{
    stepNumber: number;
    title: string;
    instruction: string;
    recommended?: string;
    bullets?: string[];
    copyBlocks?: Array<{ label: string; content: string }>;
    gbpAction?: string;
    actionData?: GbpPlanStep["actionData"];
  }>;
  keywordPriority: Array<{ rank: number; keyword: string; reason: string }>;
  weeklyCadence: string[];
  monthlyCadence: string[];
}

export async function generateGbpOptimizationPlan(
  audit: Phase1AuditPayload
): Promise<GbpOptimizationPlan> {
  const fallback = buildTemplateGbpPlan(audit);
  const targetKeywords = audit.rankings.keywords.map((k) => k.keyword);

  if (!isLlmConfigured()) {
    return fallback;
  }

  try {
    const context = buildAuditContext(audit);

    const llm = await completeJson<LlmGbpPlanResponse>(
      [
        { role: "system", content: GBP_PLAN_SYSTEM },
        {
          role: "user",
          content: `Write a comprehensive Google Business Profile Optimization Report.

BUSINESS:
Name: ${audit.clientName}
Address: ${audit.gbp.identity.address}
Phone: ${audit.gbp.identity.phone}
Website: ${audit.gbp.identity.website}
Primary category: ${audit.gbp.identity.primaryCategory}
Secondary categories: ${audit.gbp.identity.secondaryCategories.join(", ") || "none listed"}

TARGET KEYWORDS (rank in Top 3 for ALL combined):
${targetKeywords.map((k) => `- ${k}`).join("\n")}

AUDIT DATA:
${context}

Write exactly 16 steps covering ONLY GBP optimization:
1. Primary Category
2. Add Secondary Categories
3. Rewrite the Business Description (include full paste-ready description in copyBlocks)
4. Complete Every Service Section (include a copyBlock per target keyword + 5-10 additional services)
5. Products Section (one product per core keyword with descriptions)
6. Photo Optimization (specific counts by category, weekly upload goal)
7. Videos (ideas and cadence)
8. Weekly Google Posts (keyword rotation schedule for 6+ weeks)
9. Q&A Section (seed 8-12 Q&A pairs in copyBlocks with full answers)
10. Reviews Strategy (target count, keyword mix percentages, how to ask)
11. Review Responses (instruction only — personalized AI replies are generated per review in Take Action; do NOT include a generic template copyBlock)
12. Maintain Accurate Hours
13. Attributes (list which to enable)
14. Messaging
15. Booking Feature
16. Continuous Activity (weekly + monthly cadence)

For steps 3-5 and 9, include copyBlocks with ready-to-paste text customized for this business.
Do not include copyBlocks for step 11 (review responses are AI-drafted per review).

Return JSON:
{
  "title": "Google Business Profile Optimization Report",
  "objective": "one paragraph objective",
  "steps": [
    {
      "stepNumber": 1,
      "title": "step title",
      "instruction": "detailed paragraph explaining why and how",
      "recommended": "specific recommendation if applicable",
      "bullets": ["actionable bullet points"],
      "copyBlocks": [{ "label": "block label", "content": "paste-ready text" }],
      "gbpAction": "update_primary_category | add_secondary_categories | update_description | create_post | manual",
      "actionData": {
        "primaryCategory": "display name for step 1",
        "secondaryCategories": ["category display names for step 2"],
        "description": "full description text for step 3",
        "postSummary": "post text for step 8"
      }
    }
  ],
  "keywordPriority": [{ "rank": 1, "keyword": "...", "reason": "why prioritize" }],
  "weeklyCadence": ["list of weekly tasks"],
  "monthlyCadence": ["list of monthly tasks"]
}`,
        },
      ],
      { maxTokens: 12000, temperature: 0.55 }
    );

    const steps =
      llm.steps?.length >= 10
        ? llm.steps
            .sort((a, b) => a.stepNumber - b.stepNumber)
            .map((s) => ({
              stepNumber: s.stepNumber,
              title: s.title,
              instruction: s.instruction,
              recommended: s.recommended,
              bullets: s.bullets,
              copyBlocks: s.copyBlocks,
              gbpAction: s.gbpAction as GbpPlanStep["gbpAction"],
              actionData: s.actionData,
            }))
        : fallback.steps;

    return {
      title: llm.title || fallback.title,
      businessName: audit.clientName,
      address: audit.gbp.identity.address,
      objective: llm.objective || fallback.objective,
      targetKeywords,
      steps,
      keywordPriority:
        llm.keywordPriority?.length > 0 ? llm.keywordPriority : fallback.keywordPriority,
      weeklyCadence: llm.weeklyCadence?.length ? llm.weeklyCadence : fallback.weeklyCadence,
      monthlyCadence: llm.monthlyCadence?.length ? llm.monthlyCadence : fallback.monthlyCadence,
      contentSource: "llm",
    };
  } catch (error) {
    console.error("[llm] GBP plan generation failed, using template:", error);
    return fallback;
  }
}
