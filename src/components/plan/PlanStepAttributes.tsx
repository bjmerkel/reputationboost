"use client";

import { useMemo, useState } from "react";
import type { ExecutionTask, GbpAttributeCoverage } from "@/audit/types";
import type { GbpAttributeUpdate } from "@/lib/google/gbp-location";
import { attributeDisplayName } from "@/lib/google/gbp-attribute-recommendations";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";

function readAttributeUpdates(task: ExecutionTask): GbpAttributeUpdate[] {
  const raw = task.payload.attributes;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is GbpAttributeUpdate =>
      typeof item === "object" &&
      item != null &&
      typeof (item as GbpAttributeUpdate).name === "string"
  );
}

function groupLabel(
  name: string,
  coverage?: GbpAttributeCoverage
): string | undefined {
  return coverage?.missing.find((item) => item.name === name)?.groupDisplayName;
}

function attributeHint(update: GbpAttributeUpdate): string | null {
  if (update.uri) return `Sets link: ${update.uri}`;
  if (update.boolValue === true) return "Enables on your Google profile";
  return null;
}

export default function PlanStepAttributes({
  task,
  gbpConnected,
  actions,
  coverage,
  variant = "light",
}: {
  task: ExecutionTask;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  coverage?: GbpAttributeCoverage;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const attributes = useMemo(() => readAttributeUpdates(task), [task]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(attributes.map((item) => item.name))
  );
  const loading = actions.loadingTaskId === task.id;

  const selectedAttributes = attributes.filter((item) => selected.has(item.name));
  const grouped = useMemo(() => {
    const groups = new Map<string, GbpAttributeUpdate[]>();
    for (const update of attributes) {
      const group = groupLabel(update.name, coverage) ?? "Other";
      const existing = groups.get(group) ?? [];
      existing.push(update);
      groups.set(group, existing);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [attributes, coverage]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(attributes.map((item) => item.name)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function publishSelected() {
    if (selectedAttributes.length === 0) return;

    const labels = selectedAttributes.map((update) =>
      attributeDisplayName(coverage!, update.name)
    );
    const draftContent = [
      `Enable ${selectedAttributes.length} selected attribute${selectedAttributes.length === 1 ? "" : "s"} on your Google Business Profile:`,
      ...labels.map((label) => `• ${label}`),
    ].join("\n");

    await actions.approveAndPublish(task, {
      draftContent,
      payload: {
        ...task.payload,
        attributes: selectedAttributes,
        enableRecommended: false,
      },
    });
  }

  if (attributes.length === 0) {
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
            Attributes
          </p>
          <p className={`mt-0.5 text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
            Choose which attributes to enable
          </p>
          <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Uncheck any you do not want on your Google profile, then enable the rest.
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
              {selected.size} of {attributes.length} selected
            </span>
          </div>

          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
            {grouped.map(([group, items]) => (
              <div key={group}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                  {group}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {items.map((update) => {
                    const label = coverage
                      ? attributeDisplayName(coverage, update.name)
                      : update.name;
                    const hint = attributeHint(update);
                    const checked = selected.has(update.name);

                    return (
                      <li key={update.name}>
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
                            onChange={() => toggle(update.name)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className={`block text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                              {label}
                            </span>
                            {hint && (
                              <span className={`mt-0.5 block text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                                {hint}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
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
            disabled={loading || !gbpConnected || selected.size === 0}
            onClick={() => void publishSelected()}
            className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Publishing…"
              : `Enable ${selected.size} selected`}
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
          Connect Google Business Profile to publish attribute changes.
        </p>
      )}
    </div>
  );
}
