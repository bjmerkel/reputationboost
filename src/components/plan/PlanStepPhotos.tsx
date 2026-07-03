"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";

function getImagePrompt(task: ExecutionTask): string | null {
  const prompt = task.payload.imagePrompt;
  return typeof prompt === "string" && prompt.trim() ? prompt.trim() : null;
}

function isAiPhotoTask(task: ExecutionTask): boolean {
  return task.payload.aiGenerated === true || Boolean(getImagePrompt(task));
}

export default function PlanStepPhotos({
  tasks,
  gbpConnected,
  actions,
  variant = "light",
}: {
  tasks: ExecutionTask[];
  gbpConnected: boolean;
  actions: PlanTaskActions;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const photoTasks = tasks.filter((t) => t.type === "gbp_photo");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const autoGenStarted = useRef(false);

  const pendingAi = useMemo(
    () =>
      photoTasks.filter(
        (t) => isAiPhotoTask(t) && t.status !== "completed" && !t.payload.previewDataUrl
      ),
    [photoTasks]
  );

  const readyAi = useMemo(
    () =>
      photoTasks.filter(
        (t) =>
          isAiPhotoTask(t) &&
          t.status !== "completed" &&
          typeof t.payload.previewDataUrl === "string"
      ),
    [photoTasks]
  );

  const manualTasks = useMemo(
    () => photoTasks.filter((t) => !isAiPhotoTask(t) && t.status !== "completed"),
    [photoTasks]
  );

  const generatePending = useCallback(async () => {
    if (!gbpConnected || pendingAi.length === 0) return;
    setGenerating(true);
    setGenProgress("");

    for (let i = 0; i < pendingAi.length; i++) {
      const task = pendingAi[i];
      const prompt = getImagePrompt(task);
      if (!prompt) continue;

      setGenProgress(`Creating image ${i + 1} of ${pendingAi.length}…`);
      try {
        const res = await fetch("/api/google/gbp/media/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            category: task.payload.category,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.previewDataUrl) {
          throw new Error(data.error ?? "Generation failed");
        }
        await actions.savePhotoPreview(task.id, data.previewDataUrl);
      } catch {
        break;
      }
    }

    setGenProgress("");
    setGenerating(false);
  }, [actions, gbpConnected, pendingAi]);

  useEffect(() => {
    autoGenStarted.current = false;
  }, [photoTasks.map((t) => t.id).join(",")]);

  useEffect(() => {
    if (!gbpConnected || pendingAi.length === 0 || generating || autoGenStarted.current) return;
    autoGenStarted.current = true;
    void generatePending();
  }, [gbpConnected, pendingAi.length, generating, generatePending]);

  if (!gbpConnected) {
    return (
      <p className={`mt-4 text-sm ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
        Connect Google Business Profile to generate and upload photos.
      </p>
    );
  }

  if (photoTasks.length === 0) {
    return (
      <p className={`mt-4 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Building your photo plan…
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {(generating || genProgress) && (
        <p className={`text-sm ${isLight ? "text-[#9334e6]" : "text-violet-300"}`}>
          {genProgress || "Creating AI photos…"}
        </p>
      )}

      {readyAi.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {readyAi.map((task) => (
            <div
              key={task.id}
              className={`overflow-hidden rounded-lg border ${
                isLight ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
              }`}
            >
              <div className="relative aspect-[3/2] bg-[#f1f3f4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(task.payload.previewDataUrl)}
                  alt={task.title}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-full bg-[#9334e6] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  AI
                </span>
              </div>
              <div className="p-3">
                <p className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                  {task.title.replace(/^Step \d+: /, "")}
                </p>
                <button
                  type="button"
                  disabled={actions.loadingTaskId === task.id}
                  onClick={() => void actions.publishPhoto(task)}
                  className="btn-primary mt-3 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {actions.loadingTaskId === task.id ? "Uploading…" : "Approve & publish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {manualTasks.length > 0 && (
        <div className="space-y-2">
          <p className={`text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Upload your own photos
          </p>
          {manualTasks.map((task) => (
            <label
              key={task.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                isLight ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
              }`}
            >
              <span className={`text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
                {task.title.replace(/^Step \d+: /, "")}
              </span>
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                disabled={actions.loadingTaskId === task.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void actions.uploadPhotoFile(task, file);
                }}
              />
            </label>
          ))}
        </div>
      )}

      {photoTasks.every((t) => t.status === "completed") && (
        <p className={`text-sm ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>
          All photo tasks for this step are on Google.
        </p>
      )}
    </div>
  );
}
