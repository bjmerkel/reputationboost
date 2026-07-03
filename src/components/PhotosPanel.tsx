"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExecutionTask, FullAuditPayload, GbpMediaPreview } from "@/audit/types";
import ExternalImage from "@/components/ExternalImage";

interface PhotosPanelProps {
  audit: FullAuditPayload;
  clientId: string;
  auditId: string;
  gbpConnected: boolean;
  initialTasks: ExecutionTask[];
}

function getImagePrompt(task: ExecutionTask): string | null {
  const prompt = task.payload.imagePrompt;
  return typeof prompt === "string" && prompt.trim() ? prompt.trim() : null;
}

function isAiPhotoTask(task: ExecutionTask): boolean {
  return task.payload.aiGenerated === true || Boolean(getImagePrompt(task));
}

export default function PhotosPanel({
  audit,
  clientId,
  auditId,
  gbpConnected,
  initialTasks,
}: PhotosPanelProps) {
  const [tasks, setTasks] = useState(
    initialTasks.filter((t) => t.type === "gbp_photo")
  );
  const [liveMedia, setLiveMedia] = useState<GbpMediaPreview[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [batchPublishing, setBatchPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState("");
  const autoGenStarted = useRef(false);

  const storedMedia = audit.gbp.content.mediaPreviews ?? [];
  const mediaPreviews = liveMedia ?? storedMedia;

  const pendingAi = useMemo(
    () =>
      tasks.filter(
        (t) =>
          isAiPhotoTask(t) &&
          t.status !== "completed" &&
          !t.payload.previewDataUrl
      ),
    [tasks]
  );

  const pendingAiIds = useMemo(() => pendingAi.map((t) => t.id).join(","), [pendingAi]);

  const readyAi = useMemo(
    () =>
      tasks.filter(
        (t) =>
          isAiPhotoTask(t) &&
          t.status !== "completed" &&
          typeof t.payload.previewDataUrl === "string"
      ),
    [tasks]
  );

  const manualTasks = useMemo(
    () => tasks.filter((t) => !isAiPhotoTask(t) && t.status !== "completed"),
    [tasks]
  );

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/execution?clientId=${clientId}&auditId=${auditId}`);
    const data = await res.json();
    if (res.ok) {
      setTasks((data.tasks as ExecutionTask[]).filter((t) => t.type === "gbp_photo"));
    }
  }, [clientId, auditId]);

  const ensurePhotoTasks = useCallback(async () => {
    const res = await fetch("/api/execution/ensure-photo-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, auditId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to create photo plan");
    }
    if (data.tasks?.length) {
      setTasks(data.tasks as ExecutionTask[]);
    }
    return data.tasks as ExecutionTask[];
  }, [clientId, auditId]);

  useEffect(() => {
    if (!gbpConnected) return;

    let cancelled = false;

    async function loadTasks() {
      try {
        await refresh();
        if (cancelled) return;
        const res = await fetch(`/api/execution?clientId=${clientId}&auditId=${auditId}`);
        const data = await res.json();
        const photoTasks = ((data.tasks as ExecutionTask[]) ?? []).filter(
          (t) => t.type === "gbp_photo"
        );
        if (!cancelled && photoTasks.length === 0) {
          await ensurePhotoTasks();
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load photo plan");
        }
      }
    }

    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [auditId, clientId, gbpConnected, refresh, ensurePhotoTasks]);

  useEffect(() => {
    if (!gbpConnected) return;

    async function loadMedia() {
      try {
        const res = await fetch("/api/google/gbp/media");
        const data = await res.json();
        if (!res.ok) return;
        const previews: GbpMediaPreview[] = (data.items ?? [])
          .filter((item: { thumbnailUrl?: string; googleUrl?: string }) =>
            Boolean(item.thumbnailUrl || item.googleUrl)
          )
          .slice(0, 24)
          .map(
            (item: {
              thumbnailUrl?: string;
              googleUrl?: string;
              mediaFormat?: string;
              category?: string | null;
              description?: string;
            }) => ({
              thumbnailUrl: item.thumbnailUrl || item.googleUrl || "",
              googleUrl: item.googleUrl || item.thumbnailUrl || "",
              mediaFormat: item.mediaFormat === "VIDEO" ? "VIDEO" : "PHOTO",
              category: item.category ?? null,
              description: item.description || undefined,
            })
          );
        if (previews.length > 0) setLiveMedia(previews);
      } catch {
        // use audit snapshot
      }
    }

    void loadMedia();
  }, [gbpConnected, audit.auditId]);

  useEffect(() => {
    autoGenStarted.current = false;
  }, [auditId]);

  useEffect(() => {
    if (!gbpConnected || pendingAi.length === 0 || generating || autoGenStarted.current) {
      return;
    }

    autoGenStarted.current = true;
    let cancelled = false;

    async function generateAll() {
      setGenerating(true);
      setError(null);

      for (let i = 0; i < pendingAi.length; i++) {
        if (cancelled) break;
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

          await fetch(`/api/execution/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: { previewDataUrl: data.previewDataUrl } }),
          });
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Image generation failed");
          }
          break;
        }
      }

      if (!cancelled) {
        setGenProgress("");
        await refresh();
      }
      setGenerating(false);
    }

    void generateAll();
    return () => {
      cancelled = true;
    };
  }, [gbpConnected, pendingAiIds, generating, refresh]);

  async function publishPhoto(task: ExecutionTask, previewDataUrl?: string) {
    setPublishingId(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/execution/${task.id}/publish-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewDataUrl: previewDataUrl ?? task.payload.previewDataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPublishingId(null);
    }
  }

  async function publishAllReady() {
    setBatchPublishing(true);
    setError(null);
    try {
      for (const task of readyAi) {
        await publishPhoto(task);
      }
    } finally {
      setBatchPublishing(false);
    }
  }

  async function uploadManualFile(task: ExecutionTask, file: File) {
    setPublishingId(task.id);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", String(task.payload.category ?? "EXTERIOR"));
      form.append("mediaFormat", "PHOTO");

      const res = await fetch(`/api/execution/${task.id}/publish-photo`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPublishingId(null);
    }
  }

  if (!gbpConnected) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
        Connect Google Business Profile to manage and upload photos.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
        <h3 className="text-lg font-bold text-white">Your photo workflow</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          We analyze your profile, create AI marketing photos for you, and upload them to Google
          in one click. Real storefront and interior shots use your camera — everything else is
          handled here.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <StatPill label="On Google now" value={String(audit.gbp.content.photoCount)} />
          <StatPill label="Ready to upload" value={String(readyAi.length)} />
          <StatPill label="Uploaded this session" value={String(completedCount)} />
        </div>
      </div>

      {mediaPreviews.length > 0 && (
        <section>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Live on your profile
          </h4>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {mediaPreviews.map((item, i) => (
              <a
                key={`${item.googleUrl}-${i}`}
                href={item.googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square overflow-hidden rounded-lg border border-white/10 bg-slate-900/50"
              >
                <ExternalImage
                  src={item.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {(generating || genProgress) && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
          {genProgress || "Creating your AI photos…"}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {readyAi.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-white">AI photos — ready for Google</h4>
              <p className="text-sm text-slate-400">
                Review the images below, then upload them all at once.
              </p>
            </div>
            <button
              type="button"
              disabled={batchPublishing || Boolean(publishingId)}
              onClick={publishAllReady}
              className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {batchPublishing ? "Uploading…" : `Upload all ${readyAi.length} to Google`}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {readyAi.map((task) => (
              <PhotoCard
                key={task.id}
                task={task}
                previewUrl={String(task.payload.previewDataUrl)}
                isAi
                loading={publishingId === task.id}
                onPublish={() => publishPhoto(task)}
              />
            ))}
          </div>
        </section>
      )}

      {manualTasks.length > 0 && (
        <section>
          <h4 className="mb-2 text-lg font-semibold text-white">Your real photos</h4>
          <p className="mb-4 text-sm text-slate-400">
            Google requires authentic storefront and interior photos. Choose a file from your phone
            or computer — we upload it for you.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {manualTasks.map((task) => (
              <ManualPhotoCard
                key={task.id}
                task={task}
                loading={publishingId === task.id}
                onUpload={(file) => uploadManualFile(task, file)}
              />
            ))}
          </div>
        </section>
      )}

      {tasks.length === 0 && !generating && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center">
          <p className="text-slate-300">Building your photo plan…</p>
          <p className="mt-2 text-sm text-slate-500">
            AI photos are created automatically. This usually takes a few seconds.
          </p>
        </div>
      )}

      {tasks.every((t) => t.status === "completed") && tasks.length > 0 && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm text-emerald-200">
          All recommended photos are on Google. Re-run your audit to refresh counts in Deep Dive.
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
      <span className="text-slate-400">{label}: </span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function PhotoCard({
  task,
  previewUrl,
  isAi,
  loading,
  onPublish,
}: {
  task: ExecutionTask;
  previewUrl: string;
  isAi?: boolean;
  loading: boolean;
  onPublish: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]">
      <div className="relative aspect-[3/2] bg-slate-900/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={task.title} className="h-full w-full object-cover" />
        {isAi && (
          <span className="absolute left-2 top-2 rounded-full bg-violet-500/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            AI
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-medium text-white">{task.title}</p>
        {typeof task.payload.hint === "string" && (
          <p className="mt-1 text-xs text-slate-500">{task.payload.hint}</p>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={onPublish}
          className="mt-3 w-full rounded-full bg-emerald-500/20 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Upload to Google"}
        </button>
      </div>
    </div>
  );
}

function ManualPhotoCard({
  task,
  loading,
  onUpload,
}: {
  task: ExecutionTask;
  loading: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <p className="font-medium text-white">{task.title}</p>
      {typeof task.payload.hint === "string" && (
        <p className="mt-2 text-sm text-slate-400">{task.payload.hint}</p>
      )}
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[0.02] px-4 py-8 transition hover:border-emerald-500/40 hover:bg-emerald-500/5">
        <span className="text-sm font-medium text-slate-300">
          {loading ? "Uploading…" : "Tap to choose a photo"}
        </span>
        <span className="mt-1 text-xs text-slate-500">JPG or PNG from your device</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
      </label>
    </div>
  );
}
