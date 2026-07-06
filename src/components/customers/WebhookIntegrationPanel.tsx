"use client";

import { useCallback, useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

interface WebhookSettings {
  webhookUrl: string;
  autoSend: boolean;
  delayHours: number;
  triggerEvents: string[];
  samplePayload: Record<string, unknown>;
}

export default function WebhookIntegrationPanel() {
  const [settings, setSettings] = useState<WebhookSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/settings");
      const data = await parseJsonResponse<WebhookSettings & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load webhook settings");
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhook settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function updateSettings(patch: Partial<Pick<WebhookSettings, "autoSend" | "delayHours" | "triggerEvents">> & { rotateToken?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await parseJsonResponse<WebhookSettings & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to update settings");
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              webhookUrl: data.webhookUrl,
              autoSend: data.autoSend,
              delayHours: data.delayHours,
              triggerEvents: data.triggerEvents,
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5f6368]">Loading webhook integration…</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error ?? "Webhook settings unavailable"}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#202124]">Inbound webhook</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#5f6368]">
            Connect Jobber, Housecall Pro, QuickBooks, or any tool via Zapier/Make. POST
            customer + job events to automatically add contacts and optionally send review
            requests.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-[#3c4043]">
          <input
            type="checkbox"
            checked={settings.autoSend}
            disabled={saving}
            onChange={(e) => void updateSettings({ autoSend: e.target.checked })}
          />
          Auto-send on trigger events
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
            Webhook URL
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <code className="flex-1 break-all rounded-lg bg-[#f8f9fa] px-3 py-2 text-xs text-[#3c4043]">
              {settings.webhookUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyText("url", settings.webhookUrl)}
              className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
            >
              {copied === "url" ? "Copied" : "Copy URL"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
            Trigger events
          </label>
          <p className="mt-1 text-sm text-[#5f6368]">
            {settings.triggerEvents.join(", ")} — or set{" "}
            <code className="text-xs">sendReviewRequest: true</code> per payload.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
            Sample JSON payload
          </label>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-[#f8f9fa] p-3 text-xs text-[#3c4043]">
            {JSON.stringify(settings.samplePayload, null, 2)}
          </pre>
          <button
            type="button"
            onClick={() =>
              void copyText("payload", JSON.stringify(settings.samplePayload, null, 2))
            }
            className="mt-2 text-sm font-semibold text-[#1a73e8] hover:underline"
          >
            {copied === "payload" ? "Copied" : "Copy sample payload"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void updateSettings({ rotateToken: true })}
          className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa] disabled:opacity-50"
        >
          Rotate webhook token
        </button>
      </div>

      <p className="mt-4 text-xs text-[#80868b]">
        Zapier/Make tip: trigger on &quot;Job Completed&quot; or &quot;Invoice Paid&quot;, then
        POST the customer phone, name, and service to this URL.
      </p>
    </div>
  );
}
