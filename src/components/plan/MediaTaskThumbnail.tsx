"use client";

import { useEffect, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import ExternalImage from "@/components/ExternalImage";

const MEDIA_MAINTENANCE_TYPES = new Set<ExecutionTask["type"]>([
  "gbp_media_recategorize",
  "gbp_media_delete",
]);

export function isMediaMaintenanceTask(task: ExecutionTask): boolean {
  return MEDIA_MAINTENANCE_TYPES.has(task.type);
}

function thumbnailFromPayload(task: ExecutionTask): string | null {
  const url = task.payload.thumbnailUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export default function MediaTaskThumbnail({
  task,
  variant = "light",
  className = "aspect-[3/2] w-full max-w-[220px] rounded-lg object-cover",
}: {
  task: ExecutionTask;
  variant?: "light" | "dark";
  className?: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() =>
    thumbnailFromPayload(task)
  );

  useEffect(() => {
    const fromPayload = thumbnailFromPayload(task);
    if (fromPayload) {
      setResolvedUrl(fromPayload);
      return;
    }

    if (!isMediaMaintenanceTask(task)) return;

    const mediaName = task.payload.mediaName;
    if (typeof mediaName !== "string" || !mediaName.trim()) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/google/gbp/media");
        const data = (await res.json()) as {
          items?: Array<{ name?: string; thumbnailUrl?: string; googleUrl?: string }>;
        };
        if (!res.ok || cancelled) return;

        const match = data.items?.find((item) => item.name === mediaName);
        const url = match?.thumbnailUrl || match?.googleUrl;
        if (url && !cancelled) setResolvedUrl(url);
      } catch {
        // Keep audit snapshot data only
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [task.id, task.payload.thumbnailUrl, task.payload.mediaName, task.type]);

  if (!isMediaMaintenanceTask(task)) return null;

  const fallback = (
    <div
      className={`flex aspect-[3/2] w-full max-w-[220px] items-center justify-center rounded-lg px-3 text-center text-xs ${
        variant === "light" ? "bg-[#f1f3f4] text-[#80868b]" : "bg-white/5 text-slate-500"
      }`}
    >
      Photo preview unavailable
    </div>
  );

  if (!resolvedUrl) return fallback;

  return (
    <ExternalImage
      src={resolvedUrl}
      alt="Google Business Profile photo for this task"
      className={className}
      fallback={fallback}
    />
  );
}
