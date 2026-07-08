"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExecutionTask, GbpAttributeCoverage } from "@/audit/types";
import type { GbpAttributeUpdate } from "@/lib/google/gbp-location";
import {
  attributeDisplayName,
  buildUserUriAttributeUpdates,
  profileLinkUriPlaceholder,
  resolveProfileLinkMissing,
} from "@/lib/google/gbp-attribute-recommendations";
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
  return (
    coverage?.profileLinkMissing?.find((item) => item.name === name)?.groupDisplayName ??
    coverage?.missing.find((item) => item.name === name)?.groupDisplayName
  );
}

function attributeHint(update: GbpAttributeUpdate): string | null {
  if (update.uri) return `Sets link: ${update.uri}`;
  if (update.boolValue === true) return "Enables on your Google profile";
  return null;
}

function isValidAttributeUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("sms:") ||
    trimmed.startsWith("tel:")
  );
}

function isPlaceholderLikeUri(uri: string): boolean {
  const trimmed = uri.trim().toLowerCase();
  return (
    trimmed.endsWith("/your-page") ||
    trimmed.endsWith("/your-handle") ||
    trimmed.endsWith("/@your-handle") ||
    trimmed.endsWith("/@your-channel") ||
    trimmed === "https://www.facebook.com/" ||
    trimmed === "https://www.instagram.com/"
  );
}

function publishableUri(uri: string): boolean {
  return isValidAttributeUri(uri) && !isPlaceholderLikeUri(uri);
}

export default function PlanStepAttributes({
  task,
  gbpConnected,
  actions,
  coverage,
  businessPhone,
  businessWebsite,
  variant = "light",
}: {
  task: ExecutionTask;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  coverage?: GbpAttributeCoverage;
  businessPhone?: string;
  businessWebsite?: string;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const requiresUriInput = task.payload.requiresUriInput === true;

  const attributes = useMemo(() => {
    if (!requiresUriInput) return readAttributeUpdates(task);

    const profileLinks = resolveProfileLinkMissing(coverage);
    const taskAttrs = readAttributeUpdates(task);
    const configuredByName = new Map(
      (coverage?.configuredProfileLinks ?? []).map((link) => [link.name, link.uri])
    );
    const suggested = buildUserUriAttributeUpdates(profileLinks, {
      phone: businessPhone,
      websiteUri: businessWebsite,
    });

    return suggested.map((update) => ({
      ...update,
      uri:
        configuredByName.get(update.name) ||
        taskAttrs.find((item) => item.name === update.name)?.uri ||
        update.uri ||
        "",
    }));
  }, [task, coverage, requiresUriInput, businessPhone, businessWebsite]);

  const configuredProfileLinks = coverage?.configuredProfileLinks ?? [];

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [uriValues, setUriValues] = useState<Record<string, string>>({});
  const loading = actions.loadingTaskId === task.id;

  useEffect(() => {
    setSelected(new Set(attributes.map((item) => item.name)));
    setUriValues((prev) => {
      const next: Record<string, string> = {};
      for (const update of attributes) {
        next[update.name] = prev[update.name] ?? update.uri ?? "";
      }
      return next;
    });
  }, [attributes]);

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

  const selectedUriUpdates = selectedAttributes
    .map((update) => ({
      ...update,
      uri: (uriValues[update.name] ?? "").trim(),
    }))
    .filter((update) => publishableUri(update.uri ?? ""));

  const selectedBoolUpdates = selectedAttributes.filter(
    (update) => update.boolValue === true
  );

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

  function updateUri(name: string, value: string) {
    setUriValues((prev) => ({ ...prev, [name]: value }));
  }

  async function publishSelected() {
    if (requiresUriInput) {
      if (selectedUriUpdates.length === 0) return;

      const labels = selectedUriUpdates.map((update) =>
        coverage ? attributeDisplayName(coverage, update.name) : update.name
      );
      const draftContent = [
        `Add ${selectedUriUpdates.length} profile link${selectedUriUpdates.length === 1 ? "" : "s"} on your Google Business Profile:`,
        ...labels.map((label, index) => `• ${label}: ${selectedUriUpdates[index].uri}`),
      ].join("\n");

      await actions.approveAndPublish(task, {
        draftContent,
        payload: {
          ...task.payload,
          attributes: selectedUriUpdates,
          enableRecommended: false,
        },
      });
      return;
    }

    if (selectedBoolUpdates.length === 0) return;

    const labels = selectedBoolUpdates.map((update) =>
      attributeDisplayName(coverage!, update.name)
    );
    const draftContent = [
      `Enable ${selectedBoolUpdates.length} selected attribute${selectedBoolUpdates.length === 1 ? "" : "s"} on your Google Business Profile:`,
      ...labels.map((label) => `• ${label}`),
    ].join("\n");

    await actions.approveAndPublish(task, {
      draftContent,
      payload: {
        ...task.payload,
        attributes: selectedBoolUpdates,
        enableRecommended: false,
      },
    });
  }

  if (attributes.length === 0) {
    return null;
  }

  const publishCount = requiresUriInput ? selectedUriUpdates.length : selectedBoolUpdates.length;
  const publishDisabled =
    loading ||
    !gbpConnected ||
    (requiresUriInput ? selectedUriUpdates.length === 0 : selected.size === 0 || selectedBoolUpdates.length === 0);

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
            {requiresUriInput ? "Add your profile links" : "Choose which attributes to enable"}
          </p>
          <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            {requiresUriInput
              ? "Paste each social or chat link you want to add. You can publish only the links you fill in — skip the rest."
              : "Uncheck any you do not want on your Google profile, then enable the rest."}
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

      {configuredProfileLinks.length > 0 && (
        <div className="mt-3">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Already on your Google profile
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {configuredProfileLinks.map((link) => (
              <li
                key={link.name}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isLight ? "border-[#ceead6] bg-[#f6faf7] text-[#137333]" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                <div className="font-medium">{link.displayName}</div>
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
              {selected.size} of {attributes.length} selected
              {requiresUriInput && publishCount > 0 ? ` · ${publishCount} ready to publish` : ""}
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
                    const hint = requiresUriInput ? null : attributeHint(update);
                    const checked = selected.has(update.name);
                    const uriValue = uriValues[update.name] ?? "";
                    const uriInvalid =
                      requiresUriInput &&
                      checked &&
                      uriValue.trim().length > 0 &&
                      !isValidAttributeUri(uriValue);

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
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                              {label}
                            </span>
                            {hint && (
                              <span className={`mt-0.5 block text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                                {hint}
                              </span>
                            )}
                            {requiresUriInput && checked && (
                              <input
                                type="url"
                                value={uriValue}
                                onChange={(event) => updateUri(update.name, event.target.value)}
                                placeholder={profileLinkUriPlaceholder({
                                  name: update.name,
                                  displayName: label,
                                })}
                                className={`mt-2 w-full rounded-md border px-2.5 py-1.5 text-xs ${
                                  isLight
                                    ? "border-[#dadce0] bg-white text-[#202124] placeholder:text-[#80868b]"
                                    : "border-white/10 bg-black/20 text-white placeholder:text-slate-500"
                                }`}
                              />
                            )}
                            {uriInvalid && (
                              <span className="mt-1 block text-xs text-[#d93025]">
                                Enter a valid https://, sms:, or tel: link
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
            disabled={publishDisabled}
            onClick={() => void publishSelected()}
            className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Publishing…"
              : requiresUriInput
                ? `Publish ${publishCount} link${publishCount === 1 ? "" : "s"}`
                : `Enable ${publishCount} selected`}
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
