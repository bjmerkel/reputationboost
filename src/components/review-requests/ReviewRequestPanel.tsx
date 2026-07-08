"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

interface ReviewRequestPanelProps {
  businessName: string;
  reviewUrl?: string | null;
  executionTaskId?: string;
  variant?: "light" | "dark";
  onSent?: (summary: string) => void;
}

export default function ReviewRequestPanel({
  businessName,
  reviewUrl,
  executionTaskId,
  variant = "light",
  onSent,
}: ReviewRequestPanelProps) {
  const isLight = variant === "light";
  const [template, setTemplate] = useState("");
  const [preview, setPreview] = useState("");
  const [eligibleCount, setEligibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [twilioConfigured, setTwilioConfigured] = useState(true);

  const loadMessageTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review-requests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await parseJsonResponse<{
        template: string;
        preview: string;
        eligibleCount: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to generate message");
      setTemplate(data.template);
      setPreview(data.preview);
      setEligibleCount(data.eligibleCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate message");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessageTemplate();
  }, [loadMessageTemplate]);

  async function handleSend() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/review-requests/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          batchSize: 15,
          executionTaskId,
        }),
      });
      const data = await parseJsonResponse<{
        sent: number;
        failed: number;
        simulated: boolean;
        twilioConfigured?: boolean;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Send failed");

      setTwilioConfigured(data.twilioConfigured ?? true);

      const summary = data.simulated
        ? `Simulated ${data.sent} message${data.sent === 1 ? "" : "s"}. Add Twilio credentials to send real texts.`
        : `Sent ${data.sent} review request${data.sent === 1 ? "" : "s"}${data.failed ? ` (${data.failed} failed)` : ""}.`;

      setResult(summary);
      onSent?.(summary);
      await loadMessageTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {!twilioConfigured && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            isLight
              ? "border-[#fdd663] bg-[#fef7e0] text-[#3c4043]"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          SMS will be simulated until Twilio credentials are configured.
        </div>
      )}

      {error && (
        <p className={`text-sm ${isLight ? "text-[#d93025]" : "text-red-400"}`}>{error}</p>
      )}

      {result && (
        <p className={`text-sm ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>{result}</p>
      )}

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          Request more reviews
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Send a personalized Google review request by SMS to recent customers. Use placeholders:{" "}
          <code className="text-xs">[FIRST_NAME]</code>, <code className="text-xs">[SERVICE]</code>,{" "}
          <code className="text-xs">[REVIEW_LINK]</code>.
        </p>
      </div>

      {reviewUrl && (
        <p className={`truncate text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          Google review link:{" "}
          <a
            href={reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1a73e8] hover:underline"
          >
            {reviewUrl}
          </a>
        </p>
      )}

      {loading ? (
        <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>Loading message…</p>
      ) : (
        <>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={5}
            className={`w-full rounded-lg border px-3 py-2 text-sm leading-relaxed ${
              isLight
                ? "border-[#dadce0] bg-white text-[#3c4043]"
                : "border-white/10 bg-slate-900 text-slate-200"
            }`}
          />

          {preview && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                isLight ? "bg-[#f8f9fa] text-[#3c4043]" : "bg-white/5 text-slate-200"
              }`}
            >
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isLight ? "text-[#80868b]" : "text-slate-500"
                }`}
              >
                Sample preview
              </span>
              <p className="mt-1">{preview}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sending || !template.trim() || eligibleCount === 0}
              onClick={() => void handleSend()}
              className="btn-primary rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending
                ? "Sending…"
                : `Send to ${Math.min(15, eligibleCount)} customer${Math.min(15, eligibleCount) === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => void loadMessageTemplate()}
              className={`rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                isLight
                  ? "border-[#dadce0] text-[#3c4043] hover:bg-[#f8f9fa]"
                  : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              Regenerate with AI
            </button>
            <Link
              href="/platform/customers"
              className="text-sm font-medium text-[#1a73e8] hover:underline"
            >
              Manage customers →
            </Link>
          </div>

          <p className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {eligibleCount} eligible customer{eligibleCount === 1 ? "" : "s"} for{" "}
            <strong>{businessName}</strong>. Import or add customers on the Customers page if the
            list is empty.
          </p>
        </>
      )}
    </div>
  );
}
