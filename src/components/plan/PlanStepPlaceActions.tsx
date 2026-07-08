"use client";

import { useMemo, useState } from "react";
import type {
  ExecutionTask,
  GbpPlaceActionCoverage,
  GbpPlaceActionLinkSummary,
} from "@/audit/types";
import { placeActionTypeLabel } from "@/lib/google/gbp-place-actions";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";

interface PlaceActionTypeInput {
  placeActionType: string;
  displayName: string;
  suggestedUri?: string;
  recommended?: boolean;
}

function readPlaceActionTypes(task: ExecutionTask): PlaceActionTypeInput[] {
  const raw = task.payload.placeActionTypes;
  if (!Array.isArray(raw)) {
    const singleType = task.payload.placeActionType;
    if (typeof singleType === "string") {
      return [
        {
          placeActionType: singleType,
          displayName: placeActionTypeLabel(singleType),
          suggestedUri:
            typeof task.payload.suggestedUri === "string" ? task.payload.suggestedUri : "",
        },
      ];
    }
    return [];
  }

  return raw.filter(
    (item): item is PlaceActionTypeInput =>
      typeof item === "object" &&
      item != null &&
      typeof (item as PlaceActionTypeInput).placeActionType === "string"
  );
}

function isValidPlaceActionUri(uri: string): boolean {
  return uri.trim().startsWith("https://");
}

export default function PlanStepPlaceActions({
  task,
  gbpConnected,
  actions,
  coverage,
  configuredLinks = [],
  variant = "light",
}: {
  task: ExecutionTask;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  coverage?: GbpPlaceActionCoverage;
  configuredLinks?: GbpPlaceActionLinkSummary[];
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const missingTypes = useMemo(() => readPlaceActionTypes(task), [task]);
  const existingLinks = useMemo(() => {
    if (configuredLinks.length > 0) return configuredLinks;
    const raw = task.payload.configuredLinks;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is GbpPlaceActionLinkSummary =>
        typeof item === "object" &&
        item != null &&
        typeof (item as GbpPlaceActionLinkSummary).placeActionType === "string"
    );
  }, [configuredLinks, task]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(missingTypes.map((item) => item.placeActionType))
  );
  const [uriValues, setUriValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of missingTypes) {
      initial[item.placeActionType] = item.suggestedUri ?? "";
    }
    return initial;
  });
  const loading = actions.loadingTaskId === task.id;

  const selectedTypes = missingTypes.filter((item) => selected.has(item.placeActionType));
  const selectedUpdates = selectedTypes
    .map((item) => ({
      placeActionType: item.placeActionType,
      uri: (uriValues[item.placeActionType] ?? "").trim(),
    }))
    .filter((item) => isValidPlaceActionUri(item.uri));

  const canPublish =
    selectedTypes.length > 0 &&
    selectedTypes.every((item) => isValidPlaceActionUri(uriValues[item.placeActionType] ?? ""));

  function toggle(type: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(missingTypes.map((item) => item.placeActionType)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function updateUri(type: string, value: string) {
    setUriValues((prev) => ({ ...prev, [type]: value }));
  }

  async function publishSelected() {
    if (selectedUpdates.length === 0) return;

    const labels = selectedUpdates.map((item) => {
      const catalog = coverage?.typeCatalog.find(
        (entry) => entry.placeActionType === item.placeActionType
      );
      return catalog?.displayName ?? placeActionTypeLabel(item.placeActionType);
    });

    const draftContent = [
      `Add ${selectedUpdates.length} place action link${selectedUpdates.length === 1 ? "" : "s"} on your Google Business Profile:`,
      ...labels.map((label, index) => `• ${label}: ${selectedUpdates[index].uri}`),
    ].join("\n");

    await actions.approveAndPublish(task, {
      draftContent,
      payload: {
        ...task.payload,
        placeActions: selectedUpdates,
        requiresPlaceActionInput: true,
      },
    });
  }

  if (missingTypes.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Place actions
          </p>
          <p className={`mt-0.5 text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
            Booking, ordering, and shop links
          </p>
          <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Google supports these action types for your location. Add any missing links below.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            task.status === "completed"
              ? "bg-[#e6f4ea] text-[#137333]"
              : task.status === "pending_approval"
                ? "bg-[#fef7e0] text-[#e37400]"
                : "bg-[#e8f0fe] text-[#1a73e8]"
          }`}
        >
          {task.status.replace(/_/g, " ")}
        </span>
      </div>

      {existingLinks.length > 0 && (
        <div className="mt-3">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Configured
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {existingLinks.map((link) => (
              <li
                key={link.name}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isLight ? "border-[#ceead6] bg-[#f6faf7] text-[#137333]" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{link.displayType}</span>
                  {link.isPreferred && <span>Preferred</span>}
                </div>
                <p className={`mt-1 truncate ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                  {link.uri}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.status !== "completed" && (
        <>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className={`font-medium ${isLight ? "text-[#1a73e8] hover:underline" : "text-cyan-300 hover:underline"}`}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className={`font-medium ${isLight ? "text-[#1a73e8] hover:underline" : "text-cyan-300 hover:underline"}`}
            >
              Select none
            </button>
            <span className={isLight ? "text-[#80868b]" : "text-slate-500"}>
              {selected.size} of {missingTypes.length} selected
            </span>
          </div>

          <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {missingTypes.map((item) => {
              const checked = selected.has(item.placeActionType);
              const uriValue = uriValues[item.placeActionType] ?? "";
              const uriInvalid = checked && !isValidPlaceActionUri(uriValue);

              return (
                <li key={item.placeActionType}>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 ${
                      checked
                        ? isLight
                          ? "border-[#1a73e8] bg-[#e8f0fe]"
                          : "border-cyan-500/40 bg-cyan-500/10"
                        : isLight
                          ? "border-[#dadce0] bg-white"
                          : "border-white/8 bg-white/[0.02]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(item.placeActionType)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                          {item.displayName}
                        </span>
                        {item.recommended && (
                          <span className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-medium text-[#e37400]">
                            Recommended
                          </span>
                        )}
                      </span>
                      {checked && (
                        <input
                          type="url"
                          value={uriValue}
                          onChange={(event) => updateUri(item.placeActionType, event.target.value)}
                          placeholder="https://..."
                          className={`mt-2 w-full rounded-md border px-2.5 py-1.5 text-xs ${
                            isLight
                              ? "border-[#dadce0] bg-white text-[#202124] placeholder:text-[#80868b]"
                              : "border-white/10 bg-black/20 text-white placeholder:text-slate-500"
                          }`}
                        />
                      )}
                      {uriInvalid && (
                        <span className="mt-1 block text-xs text-[#d93025]">
                          Enter a valid https:// URL
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {task.result && (
        <p className={`mt-3 text-sm ${task.status === "failed" ? "text-[#d93025]" : "text-[#137333]"}`}>
          {task.status === "failed" ? "✗" : "✓"} {task.result}
        </p>
      )}

      {task.status === "pending_approval" || task.status === "approved" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !gbpConnected || !canPublish}
            onClick={() => void publishSelected()}
            className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Publishing…"
              : `Publish ${selectedUpdates.length} link${selectedUpdates.length === 1 ? "" : "s"}`}
          </button>
          {task.status === "pending_approval" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void actions.rejectTask(task.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50 ${
                isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
              }`}
            >
              Skip
            </button>
          )}
        </div>
      ) : null}

      {!gbpConnected && task.status === "pending_approval" && (
        <p className={`mt-3 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          Connect Google Business Profile to publish place action links.
        </p>
      )}
    </div>
  );
}
