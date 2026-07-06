"use client";

import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import type { ActionAttribution } from "@/audit/types/timeseries";
import {
  getGoogleDiffFields,
  getGooglePendingFields,
} from "@/lib/google/gbp-update-helpers";
import PlanStepTaskRow from "./PlanStepTaskRow";

export default function GoogleUpdatesPanel({
  audit,
  gbpConnected,
  actions,
  attributionByTaskId = {},
  tasks,
  syncing = false,
  onRefresh,
  variant = "light",
}: {
  audit: FullAuditPayload;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  attributionByTaskId?: Record<string, ActionAttribution>;
  tasks: ExecutionTask[];
  syncing?: boolean;
  onRefresh?: () => void;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const diffFields = getGoogleDiffFields(audit);
  const pendingFields = getGooglePendingFields(audit);

  if (diffFields.length === 0 && pendingFields.length === 0) return null;

  const suggestionTasks = tasks.filter(
    (task) => task.type === "gbp_accept_suggestion" || task.type === "gbp_reject_suggestion"
  );

  return (
    <section
      id="google-updates-panel"
      className={`rounded-xl border p-5 ${
        isLight ? "border-[#feefc3] bg-[#fef7e0]" : "border-amber-500/20 bg-amber-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-base font-semibold ${isLight ? "text-[#b06000]" : "text-amber-200"}`}>
            Google profile updates
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Google separates processing updates from conflicts. Processing fields need time; conflicts
            need your decision.
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            disabled={syncing}
            onClick={onRefresh}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium disabled:opacity-50 ${
              isLight ? "border-[#dadce0] bg-white text-[#3c4043]" : "border-white/10 text-slate-300"
            }`}
          >
            {syncing ? "Refreshing…" : "Refresh from Google"}
          </button>
        )}
      </div>

      {pendingFields.length > 0 && (
        <div className="mt-4">
          <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
            Processing on Google
          </p>
          <ul className={`mt-2 space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
            {pendingFields.map((field) => (
              <li
                key={field.field}
                className={`rounded-lg border px-3 py-2 ${
                  isLight ? "border-[#ceead6] bg-[#e6f4ea]" : "border-emerald-500/20 bg-emerald-500/5"
                }`}
              >
                <span className="font-medium">{field.label}</span>
                <span className={`block text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                  Submitted value: {field.ownerValue}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diffFields.length > 0 && (
        <div className="mt-4">
          <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#b06000]" : "text-amber-200"}`}>
            Needs your decision
          </p>
          <div className="mt-2 space-y-3">
            {diffFields.map((field) => (
              <div
                key={field.field}
                className={`rounded-lg border p-3 ${
                  isLight ? "border-[#fdd663] bg-white" : "border-white/10 bg-black/20"
                }`}
              >
                <p className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                  {field.label}
                </p>
                <div className={`mt-2 grid gap-2 text-sm sm:grid-cols-2 ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
                  <div>
                    <p className={`text-xs font-medium uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                      Your version
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{field.ownerValue}</p>
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                      Google shows
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{field.googleValue}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestionTasks.length > 0 && (
        <div className="mt-4 space-y-3">
          {suggestionTasks.map((task) => (
            <PlanStepTaskRow
              key={task.id}
              task={task}
              gbpConnected={gbpConnected}
              actions={actions}
              attribution={attributionByTaskId[task.id]}
              variant={variant}
            />
          ))}
        </div>
      )}
    </section>
  );
}
