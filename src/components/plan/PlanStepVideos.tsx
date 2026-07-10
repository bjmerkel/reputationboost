"use client";

import { useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";

export default function PlanStepVideos({
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
  const videoTasks = tasks.filter((t) => t.type === "gbp_video");
  const pending = videoTasks.filter((t) => t.status !== "completed");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  if (!gbpConnected) {
    return (
      <p className={`mt-4 text-sm ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
        Connect Google Business Profile to upload videos.
      </p>
    );
  }

  if (videoTasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <p className={`text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
        Videos
      </p>
      <p className={`text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Upload MP4 or MOV clips (30–60 seconds, at least 100 KB). Google displays them on your profile.
      </p>

      {message && (
        <p className={`text-sm ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>{message}</p>
      )}

      {pending.map((task) => (
        <label
          key={task.id}
          className={`flex cursor-pointer flex-col gap-3 rounded-lg border px-3 py-3 ${
            isLight ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
          }`}
        >
          <div className="min-w-0">
            <p className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
              {task.title.replace(/^Step \d+: /, "")}
            </p>
            {typeof task.payload.hint === "string" && (
              <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {task.payload.hint}
              </p>
            )}
          </div>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/*"
            className="block w-full min-w-0 max-w-full text-xs"
            disabled={actions.loadingTaskId === task.id || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setMessage("");
              void actions
                .uploadVideoFile(task, file)
                .then(() => setMessage("Video uploaded to Google."))
                .catch(() => undefined)
                .finally(() => setUploading(false));
            }}
          />
        </label>
      ))}

      {videoTasks.every((t) => t.status === "completed") && (
        <p className={`text-sm ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>
          All video tasks completed.
        </p>
      )}
    </div>
  );
}
