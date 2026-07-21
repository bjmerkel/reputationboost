"use client";

import { useCallback, useEffect, useState } from "react";
import type { RankingExperiment } from "@/audit/autopilot/types";
import {
  AUTOPILOT_MODE_DESCRIPTIONS,
  AUTOPILOT_MODE_LABELS,
  type AutopilotMode,
} from "@/audit/autopilot/modes";
import { formatCellDirection } from "@/audit/autopilot/leader-delta-engine";
import type { UserNotification } from "@/audit/storage-notifications";
import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";

const STATUS_LABELS: Record<RankingExperiment["status"], string> = {
  proposed: "Suggested",
  pending_approval: "Needs approval",
  running: "Approved",
  measuring: "Measuring",
  won: "Won",
  lost: "No movement",
  inconclusive: "Inconclusive",
  cancelled: "Cancelled",
};

const MODES: AutopilotMode[] = ["off", "manual", "suggest", "auto"];

export default function PlanAutopilotPanel({
  clientId,
  variant = "light",
  unreadNotifications = [],
  onOpenTask,
}: {
  clientId: string;
  variant?: "light" | "dark";
  unreadNotifications?: UserNotification[];
  onOpenTask?: (taskId: string, stepNumber?: number | null) => void;
}) {
  const isLight = variant === "light";
  const [experiments, setExperiments] = useState<RankingExperiment[]>([]);
  const [autopilotMode, setAutopilotMode] = useState<AutopilotMode>("manual");
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [experimentsRes, settingsRes] = await Promise.all([
        fetch(`/api/autopilot/experiments?clientId=${encodeURIComponent(clientId)}`),
        fetch(`/api/autopilot/settings?clientId=${encodeURIComponent(clientId)}`),
      ]);
      if (experimentsRes.ok) {
        const data = (await experimentsRes.json()) as { experiments?: RankingExperiment[] };
        setExperiments(data.experiments ?? []);
      }
      if (settingsRes.ok) {
        const data = (await settingsRes.json()) as { autopilotMode?: AutopilotMode };
        if (data.autopilotMode) setAutopilotMode(data.autopilotMode);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateMode(mode: AutopilotMode) {
    setSavingMode(true);
    try {
      const res = await fetch("/api/autopilot/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, autopilotMode: mode }),
      });
      if (res.ok) {
        const data = (await res.json()) as { autopilotMode?: AutopilotMode };
        setAutopilotMode(data.autopilotMode ?? mode);
      }
    } finally {
      setSavingMode(false);
    }
  }

  async function activateSuggestion(experimentId: string) {
    setActionId(experimentId);
    try {
      const res = await fetch("/api/autopilot/experiments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, experimentId, action: "activate" }),
      });
      if (res.ok) await load();
    } finally {
      setActionId(null);
    }
  }

  async function dismissSuggestion(experimentId: string) {
    setActionId(experimentId);
    try {
      const res = await fetch("/api/autopilot/experiments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, experimentId, action: "dismiss" }),
      });
      if (res.ok) await load();
    } finally {
      setActionId(null);
    }
  }

  if (loading) return null;
  if (autopilotMode === "off" && experiments.length === 0) return null;

  const suggested = experiments.filter(
    (exp) => exp.status === "proposed" && exp.origin === "suggested"
  );
  const active = experiments.filter((exp) =>
    ["pending_approval", "running", "measuring"].includes(exp.status)
  );
  const recent = experiments.filter((exp) =>
    ["won", "lost", "inconclusive"].includes(exp.status)
  );

  return (
    <section
      className={`rounded-xl border p-4 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-slate-900"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              isLight ? "text-[#80868b]" : "text-slate-500"
            }`}
          >
            Ranking autopilot
          </p>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Per-cell experiments run through your approval queue and measure grid movement.
          </p>
        </div>
        <label className={`text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Mode
          <select
            value={autopilotMode}
            disabled={savingMode}
            onChange={(event) => void updateMode(event.target.value as AutopilotMode)}
            className={`mt-1 block rounded-lg border px-2 py-1.5 text-xs font-medium ${
              isLight
                ? "border-[#dadce0] bg-white text-[#202124]"
                : "border-white/10 bg-slate-950 text-white"
            }`}
          >
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {AUTOPILOT_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={`mt-2 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
        {AUTOPILOT_MODE_DESCRIPTIONS[autopilotMode]}
      </p>

      {unreadNotifications.length > 0 && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 ${
            isLight ? "border-[#d2e3fc] bg-[#e8f0fe]" : "border-sky-400/20 bg-sky-400/10"
          }`}
        >
          <p className={`text-xs font-semibold ${isLight ? "text-[#1a73e8]" : "text-sky-300"}`}>
            {unreadNotifications.length} new update
            {unreadNotifications.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-1 space-y-1">
            {unreadNotifications.slice(0, 3).map((notification) => (
              <li
                key={notification.id}
                className={`text-xs ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}
              >
                {notification.title} — {notification.body}
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggested.length > 0 && (
        <ul className="mt-3 space-y-2">
          {suggested.map((experiment) => (
            <li
              key={experiment.id}
              className={`rounded-lg border px-3 py-3 ${
                isLight ? "border-[#d2e3fc] bg-[#f8fbff]" : "border-sky-400/20 bg-sky-400/10"
              }`}
            >
              <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                Suggested: {experiment.keyword}
              </p>
              <p className={`mt-0.5 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {formatCellDirection(experiment.gridNorth, experiment.gridEast)} · beat{" "}
                {experiment.leaderName}
              </p>
              <p className={`mt-1 text-xs ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
                {experiment.hypothesis}
              </p>
              {experiment.banditMetadata?.explorationReason && (
                <p className={`mt-1 text-xs ${isLight ? "text-[#1a73e8]" : "text-sky-300"}`}>
                  {experiment.banditMetadata.explorationReason}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionId === experiment.id}
                  onClick={() => void activateSuggestion(experiment.id)}
                  className="rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Queue for approval
                </button>
                <button
                  type="button"
                  disabled={actionId === experiment.id}
                  onClick={() => void dismissSuggestion(experiment.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    isLight
                      ? "border-[#dadce0] text-[#5f6368]"
                      : "border-white/10 text-slate-400"
                  }`}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <ul className="mt-3 space-y-2">
          {active.map((experiment) => (
            <li
              key={experiment.id}
              className={`rounded-lg border px-3 py-3 ${
                isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                    {experiment.keyword}
                    {experiment.origin === "auto" && (
                      <span className={`ml-2 text-[10px] font-medium ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                        auto
                      </span>
                    )}
                  </p>
                  <p className={`mt-0.5 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                    {formatCellDirection(experiment.gridNorth, experiment.gridEast)} · beat{" "}
                    {experiment.leaderName}
                  </p>
                  <p className={`mt-1 text-xs ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
                    {experiment.hypothesis}
                  </p>
                  {experiment.banditMetadata?.explorationReason && (
                    <p className={`mt-1 text-xs ${isLight ? "text-[#1a73e8]" : "text-sky-300"}`}>
                      {experiment.banditMetadata.explorationReason}
                    </p>
                  )}
                  {(experiment.targetRankBefore != null ||
                    experiment.targetRankAfter != null) && (
                    <p className={`mt-1 text-xs ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
                      Target cell:{" "}
                      {experiment.targetRankBefore == null
                        ? "not visible"
                        : `#${experiment.targetRankBefore}`}{" "}
                      →{" "}
                      {experiment.targetRankAfter == null
                        ? "not visible"
                        : `#${experiment.targetRankAfter}`}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    experiment.status === "measuring"
                      ? isLight
                        ? "bg-[#e8f0fe] text-[#1a73e8]"
                        : "bg-sky-400/15 text-sky-300"
                      : isLight
                        ? "bg-[#fef7e0] text-[#b06000]"
                        : "bg-amber-400/15 text-amber-300"
                  }`}
                >
                  {STATUS_LABELS[experiment.status]}
                </span>
              </div>
              {experiment.executionTaskId && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenTask?.(experiment.executionTaskId!, experiment.planStepNumber);
                    if (experiment.planStepNumber != null) {
                      document
                        .getElementById(planScrollElementId(experiment.planStepNumber))
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={`mt-2 text-xs font-semibold ${
                    isLight ? "text-[#1a73e8]" : "text-sky-300"
                  }`}
                >
                  Open approval task →
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isLight ? "text-[#80868b]" : "text-slate-500"
            }`}
          >
            Recent results
          </p>
          <ul className="mt-2 space-y-1.5">
            {recent.slice(0, 3).map((experiment) => (
              <li
                key={experiment.id}
                className={`text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}
              >
                <span className={`font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                  {experiment.keyword}
                </span>{" "}
                · {STATUS_LABELS[experiment.status]}
                {experiment.conclusionReason ? ` — ${experiment.conclusionReason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {experiments.length === 0 && autopilotMode !== "off" && (
        <p className={`mt-3 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          No experiments yet. Use the map&apos;s beat-the-leader panel or enable Suggest/Auto mode.
        </p>
      )}
    </section>
  );
}
