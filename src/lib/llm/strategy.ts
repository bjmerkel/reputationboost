import type { Phase1AuditPayload, StrategyReport } from "@/audit/types";
import { buildStrategy as buildStrategyBase } from "@/audit/phase2/strategy";
import { buildAuditContext } from "./audit-context";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { normalizeTextContent } from "./normalize-content";

interface LlmStrategyResponse {
  executiveSummary: string;
  biggestThreat: string;
  biggestWin: string | null;
  kpiTargets: string[];
  actionDrafts: Record<string, unknown>;
}

const STRATEGY_SYSTEM = `You are a local SEO strategist for Google Business Profile and Google Maps Local 3-Pack optimization.
Write concise, actionable copy for local service businesses. Use real data from the audit — never invent metrics.
Tone: direct, professional, encouraging. Reference specific keywords, review counts, and competitors when relevant.
Return valid JSON only.`;

export async function generateStrategy(
  audit: Phase1AuditPayload,
  priorAudit: Phase1AuditPayload | null = null
): Promise<StrategyReport> {
  const base = buildStrategyBase(audit, priorAudit);

  if (!isLlmConfigured()) {
    return { ...base, contentSource: "template" };
  }

  try {
    const context = buildAuditContext(audit);
    const actionIds = base.actionPlan.map((a, i) => ({
      actionId: a.id,
      gapId: base.gaps[i]?.id ?? a.id,
      title: a.title,
    }));

    const llm = await completeJson<LlmStrategyResponse>(
      [
        { role: "system", content: STRATEGY_SYSTEM },
        {
          role: "user",
          content: `Analyze this local business audit and produce strategy copy.

AUDIT DATA:
${context}

PRIOR GAPS (deterministic, do not change priorities):
${JSON.stringify(base.gaps.slice(0, 12).map((g) => ({ id: g.id, title: g.title, priority: g.priority })))}

ACTION ITEMS (write draftCopy for each using gapId as key in actionDrafts):
${JSON.stringify(actionIds)}

Return JSON:
{
  "executiveSummary": "2-3 sentences summarizing health score, 3-pack status, and top priority",
  "biggestThreat": "1 sentence on the most urgent competitive or visibility risk",
  "biggestWin": "1 sentence on the best recent progress, or null if first audit",
  "kpiTargets": ["3-5 measurable 30-day targets"],
  "actionDrafts": { "gap-id-or-action-id": "ready-to-use draft copy for that action" }
}`,
        },
      ],
      { maxTokens: 2500 }
    );

    const actionPlan = base.actionPlan.map((action, i) => {
      const gapId = base.gaps[i]?.id ?? "";
      const rawDraft =
        llm.actionDrafts[gapId] ??
        llm.actionDrafts[action.id] ??
        action.draftCopy;
      const draftCopy = normalizeTextContent(rawDraft);

      return draftCopy ? { ...action, draftCopy } : action;
    });

    return {
      ...base,
      executiveSummary: llm.executiveSummary || base.executiveSummary,
      biggestThreat: llm.biggestThreat || base.biggestThreat,
      biggestWin: llm.biggestWin ?? base.biggestWin,
      kpiTargets: llm.kpiTargets?.length ? llm.kpiTargets.slice(0, 5) : base.kpiTargets,
      actionPlan,
      contentSource: "llm",
    };
  } catch (error) {
    console.error("[llm] strategy generation failed, using templates:", error);
    return { ...base, contentSource: "template" };
  }
}
