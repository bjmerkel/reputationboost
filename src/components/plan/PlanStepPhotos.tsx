"use client";

import { useCallback, useMemo, useState } from "react";
import type { ExecutionTask, GbpMediaCoverage } from "@/audit/types";
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
  mediaCoverage,
  variant = "light",
}: {
  tasks: ExecutionTask[];
  gbpConnected: boolean;
  actions: PlanTaskActions;
  mediaCoverage?: GbpMediaCoverage;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const photoTasks = tasks.filter((t) => t.type === "gbp_photo");
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [loadingPhotoPlan, setLoadingPhotoPlan] = useState(false);
  const [photoPlanError, setPhotoPlanError] = useState<string | null>(null);

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
  const [batchMessage, setBatchMessage] = useState("");

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

  const loadPhotoPlan = useCallback(async () => {
    setLoadingPhotoPlan(true);
    setPhotoPlanError(null);
    try {
      await actions.ensurePhotoTasks();
    } catch (error) {
      setPhotoPlanError(error instanceof Error ? error.message : "Failed to load photo tasks");
    } finally {
      setLoadingPhotoPlan(false);
    }
  }, [actions]);

  if (!gbpConnected) {
    return (
      <p className={`mt-4 text-sm ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
        Connect Google Business Profile to generate and upload photos.
      </p>
    );
  }

  if (photoTasks.length === 0) {
    return (
      <div className="mt-4 space-y-2">
        <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Load your photo checklist when you&apos;re ready — we won&apos;t generate previews until you ask.
        </p>
        <button
          type="button"
          disabled={loadingPhotoPlan}
          onClick={() => void loadPhotoPlan()}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
            isLight
              ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]"
              : "border-sky-400/40 bg-sky-400/15 text-sky-300 hover:bg-sky-400/25"
          }`}
        >
          {loadingPhotoPlan ? "Loading…" : "Load photo tasks"}
        </button>
        {photoPlanError && (
          <p className={`text-xs ${isLight ? "text-[#c5221f]" : "text-red-400"}`}>{photoPlanError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {mediaCoverage && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            isLight ? "border-[#dadce0] bg-[#f8f9fa] text-[#5f6368]" : "border-white/8 bg-white/[0.02] text-slate-400"
          }`}
        >
          <span className={isLight ? "font-medium text-[#202124]" : "font-medium text-slate-200"}>
            Current media health:
          </span>{" "}
          {mediaCoverage.ownerPhotoCount} owner · {mediaCoverage.customerPhotoCount} customer
          {mediaCoverage.customerPhotoShare > 0 ? ` (${mediaCoverage.customerPhotoShare}% customer)` : ""}
          {mediaCoverage.photoViewsAvailable ? (
            <>
              {" · "}
              {mediaCoverage.totalViews.toLocaleString()} total views
              {mediaCoverage.ownerAvgViews > 0
                ? ` · ${mediaCoverage.ownerAvgViews} avg owner views`
                : ""}
            </>
          ) : (
            " · per-photo views unavailable from Google"
          )}
          {" · "}
          engagement {mediaCoverage.engagementScore}%
        </div>
      )}

      {(generating || genProgress) && (
        <p className={`text-sm ${isLight ? "text-[#9334e6]" : "text-violet-300"}`}>
          {genProgress || "Creating AI photos…"}
        </p>
      )}

      {pendingAi.length > 0 && !generating && (
        <button
          type="button"
          onClick={() => void generatePending()}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            isLight
              ? "border-[#9334e6] bg-[#f3e8fd] text-[#9334e6] hover:bg-[#e9d5ff]"
              : "border-violet-400/40 bg-violet-400/15 text-violet-300 hover:bg-violet-400/25"
          }`}
        >
          Generate {pendingAi.length} AI preview{pendingAi.length === 1 ? "" : "s"}
        </button>
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
          {manualTasks.length >= 2 && actions.uploadPhotoBatch && (
            <label
              className={`flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed px-3 py-3 ${
                isLight ? "border-[#dadce0] bg-[#f8f9fa]" : "border-white/12 bg-white/[0.02]"
              }`}
            >
              <span className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                Batch upload by category
              </span>
              <span className={`text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                Select multiple images — each maps to a pending category task in order.
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="text-xs"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  const categories = manualTasks
                    .slice(0, files.length)
                    .map((task) => String(task.payload.category ?? "ADDITIONAL"));
                  setBatchMessage("");
                  void actions
                    .uploadPhotoBatch(files, categories)
                    .then((result) =>
                      setBatchMessage(`Uploaded ${result.uploaded} of ${result.total} photos to Google.`)
                    )
                    .catch(() => undefined);
                }}
              />
            </label>
          )}
          {batchMessage && (
            <p className={`text-xs ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>{batchMessage}</p>
          )}
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
