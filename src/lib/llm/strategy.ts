import type { Phase1AuditPayload, StrategyReport } from "@/audit/types";
import type { OutcomesContext } from "@/audit/outcomes/types";
import { buildStrategy as buildStrategyBase } from "@/audit/phase2/strategy";
import { simulateGapDriverImpact } from "@/audit/phase2/counterfactual";
import { buildAuditContext } from "./audit-context";
import { buildOutcomesContext, OUTCOMES_STRATEGY_INSTRUCTION } from "./outcomes-context";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { generateGbpOptimizationPlan } from "./gbp-plan";
import { normalizeTextContent } from "./normalize-content";

interface LlmStrategyResponse {
  executiveSummary: string;
  biggestThreat: string;
  biggestWin: string | null;
  kpiTargets: string[];
  actionDrafts: Record<string, unknown>;
  emphasizedGapIds?: string[];
}

const STRATEGY_SYSTEM = `You are a local SEO strategist for Google Business Profile and Google Maps Local 3-Pack optimization.
Write concise, actionable copy for local service businesses. Use real data from the audit — never invent metrics.
Tone: direct, professional, encouraging. Reference specific keywords, review counts, and competitors when relevant.
Gaps include simulated driverScoreImpact values — exact point gains if that gap is closed. Use these to justify emphasis in your narrative.
You may highlight which gaps matter most via emphasizedGapIds, but do not invent new gaps or metrics.
${OUTCOMES_STRATEGY_INSTRUCTION}
Return valid JSON only.`;

function summarizeGapsForStrategy(
  audit: Phase1AuditPayload,
  gaps: StrategyReport["gaps"]
) {
  return gaps.slice(0, 12).map((gap) => ({
    id: gap.id,
    title: gap.title,
    priority: gap.priority,
    driverScoreImpact: simulateGapDriverImpact(audit, gap),
    description: gap.description.slice(0, 200),
  }));
}

export async function generateStrategy(
  audit: Phase1AuditPayload,
  priorAudit: Phase1AuditPayload | null = null,
  outcomes: OutcomesContext | null = null
): Promise<StrategyReport> {
  const base = buildStrategyBase(audit, priorAudit, outcomes);
  const gbpPlan = await generateGbpOptimizationPlan(audit, outcomes);

  if (!isLlmConfigured()) {
    return { ...base, gbpPlan, contentSource: "template" };
  }

  try {
    const context = buildAuditContext(audit);
    const outcomesBlock = buildOutcomesContext(outcomes);
    const gapSummary = summarizeGapsForStrategy(audit, base.gaps);
    const actionIds = base.actionPlan.map((a, i) => ({
      actionId: a.id,
      gapId: base.gaps[i]?.id ?? a.id,
      title: a.title,
      driverScoreImpact: base.gaps[i]
        ? simulateGapDriverImpact(audit, base.gaps[i])
        : 0,
    }));

    const llm = await completeJson<LlmStrategyResponse>(
      [
        { role: "system", content: STRATEGY_SYSTEM },
        {
          role: "user",
          content: `Analyze this local business audit and produce strategy copy.

AUDIT DATA:
${context}
${outcomesBlock ? `\nACTION OUTCOMES (what worked and what didn't — use to steer recommendations):\n${outcomesBlock}\n` : ""}
GAP CANDIDATES (with exact simulated driver-score impact if closed):
${JSON.stringify(gapSummary)}

ACTION ITEMS (write draftCopy for each using gapId as key in actionDrafts):
${JSON.stringify(actionIds)}

Return JSON:
{
  "executiveSummary": "2-3 sentences summarizing health score, 3-pack status, and top priority — reference highest-impact gaps",
  "biggestThreat": "1 sentence on the most urgent competitive or visibility risk",
  "biggestWin": "1 sentence on the best recent progress, or null if first audit",
  "kpiTargets": ["3-5 measurable 30-day targets tied to selected gaps"],
  "emphasizedGapIds": ["gap ids to highlight as top priorities — subset of provided gaps"],
  "actionDrafts": { "gap-id-or-action-id": "ready-to-use draft copy for that action" }
}`,
        },
      ],
      { maxTokens: 2500 }
    );

    const emphasized = new Set(llm.emphasizedGapIds ?? []);
    const enrichedActions = base.actionPlan.map((action, i) => {
      const gapId = base.gaps[i]?.id ?? "";
      const rawDraft =
        llm.actionDrafts[gapId] ??
        llm.actionDrafts[action.id] ??
        action.draftCopy;
      const draftCopy = normalizeTextContent(rawDraft);

      return {
        gapId,
        action: draftCopy ? { ...action, draftCopy } : action,
      };
    });

    if (emphasized.size > 0) {
      enrichedActions.sort((a, b) => {
        const aEm = emphasized.has(a.gapId) ? 0 : 1;
        const bEm = emphasized.has(b.gapId) ? 0 : 1;
        return aEm - bEm;
      });
    }

    const actionPlan = enrichedActions.map((row) => row.action);

    return {
      ...base,
      executiveSummary: llm.executiveSummary || base.executiveSummary,
      biggestThreat: llm.biggestThreat || base.biggestThreat,
      biggestWin: llm.biggestWin ?? base.biggestWin,
      kpiTargets: llm.kpiTargets?.length ? llm.kpiTargets.slice(0, 5) : base.kpiTargets,
      actionPlan,
      gbpPlan,
      contentSource: "llm",
    };
  } catch (error) {
    console.error("[llm] strategy generation failed, using templates:", error);
    return { ...base, gbpPlan, contentSource: "template" };
  }
}
