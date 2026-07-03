"use client";

import { useState } from "react";

export default function AiPhotoPreview({
  prompt,
  category,
}: {
  prompt: string;
  category?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/google/gbp/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, category }),
      });
      const data = (await res.json()) as {
        previewDataUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.previewDataUrl) {
        throw new Error(data.error ?? "Preview generation failed");
      }
      setPreview(data.previewDataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
        AI image preview
      </p>

      {preview ? (
        <div className="mt-2 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="AI-generated GBP photo preview"
            className="max-h-72 w-full rounded-lg border border-white/10 object-cover"
          />
          <p className="text-xs text-slate-500">
            Preview only — approve and execute the task to upload this image to Google.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={generatePreview}
            className="text-xs font-medium text-violet-300 hover:text-violet-200 disabled:opacity-50"
          >
            Regenerate preview
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-slate-400">
            Generate a preview before approving. The same image is created again when you execute
            the task.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={generatePreview}
            className="mt-2 rounded-full bg-violet-500/20 px-4 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/30 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate preview"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
