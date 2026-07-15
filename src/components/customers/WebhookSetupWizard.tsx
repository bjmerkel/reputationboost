"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

interface ZapierTemplate {
  id: string;
  label: string;
  description: string;
  templateUrl: string;
  eventType: string;
  sampleFields: string[];
}

interface WebhookSettings {
  webhookUrl: string;
  autoSend: boolean;
  delayHours: number;
  triggerEvents: string[];
  auditHasReviewGap?: boolean;
  privateFeedbackUrl?: string | null;
  zapierSteps?: string[];
  zapierTemplates?: ZapierTemplate[];
  samplePayload: Record<string, unknown>;
  optOutSamplePayload?: Record<string, unknown>;
}

const WIZARD_STEP_KEY = "rb-webhook-wizard-step";
const WIZARD_TEMPLATE_KEY = "rb-webhook-wizard-template";

const CUSTOM_TEMPLATE: ZapierTemplate = {
  id: "custom",
  label: "Other — Zapier, Make, or custom",
  description: "Build your own automation with Webhooks by Zapier or Make.",
  templateUrl: "https://zapier.com/apps/webhook/integrations",
  eventType: "job.completed",
  sampleFields: ["phone", "firstName", "lastName", "service", "externalId"],
};

const STEPS = [
  { id: "tool", label: "Choose tool" },
  { id: "settings", label: "Preferences" },
  { id: "webhook", label: "Webhook URL" },
  { id: "zapier", label: "Connect Zapier" },
  { id: "done", label: "Test & finish" },
] as const;

type WizardStepId = (typeof STEPS)[number]["id"];

const TOOL_ICONS: Record<string, string> = {
  "jobber-job-completed": "🔧",
  "hcp-job-completed": "🏠",
  "quickbooks-invoice-paid": "📒",
  custom: "⚡",
  "customer-opt-out": "🛑",
};

function getSetupSteps(template: ZapierTemplate, webhookUrl: string): string[] {
  const fieldHint =
    template.id === "jobber-job-completed"
      ? "Map Jobber customer phone, first/last name, and job type or line items into phone, firstName, lastName, and service."
      : template.id === "hcp-job-completed"
        ? "Map Housecall Pro customer phone, name, and job description into phone, firstName/lastName, and service."
        : template.id === "quickbooks-invoice-paid"
          ? "Map QuickBooks customer phone, name, and line item description into phone, name fields, and service."
          : "Map customer phone, name, and job or service description into the matching JSON fields.";

  if (template.id === "customer-opt-out") {
    return [
      "Create a Zap that triggers when a customer replies STOP or unsubscribes (e.g. Twilio → New SMS).",
      "Add Webhooks by Zapier → POST as the action.",
      `Paste this URL: ${webhookUrl}`,
      'Set the JSON body with event: "customer.opted_out", phone, and optedOut: true.',
      "Turn the Zap on — future review requests will skip opted-out numbers.",
    ];
  }

  return [
    `Open the ${template.label.split("—")[0]?.trim() ?? "integration"} template in Zapier (button below).`,
    "Connect your account and pick the trigger (job completed or invoice paid).",
    "Add Webhooks by Zapier → POST as the action.",
    `Paste your webhook URL: ${webhookUrl}`,
    fieldHint,
    `Include "event": "${template.eventType}" in the JSON body (or set sendReviewRequest: true per job).`,
    "Test the Zap, then turn it on.",
  ];
}

function buildSamplePayload(
  template: ZapierTemplate,
  base: Record<string, unknown>
): Record<string, unknown> {
  if (template.id === "quickbooks-invoice-paid") {
    return {
      ...base,
      event: "invoice.paid",
      source: "quickbooks",
      service: "hvac maintenance",
    };
  }
  if (template.id === "hcp-job-completed") {
    return {
      ...base,
      event: "job.completed",
      source: "housecall_pro",
      firstName: "Jane",
      lastName: "Doe",
    };
  }
  if (template.id === "customer-opt-out") {
    return {
      event: "customer.opted_out",
      phone: "214-555-0100",
      optedOut: true,
      source: "twilio",
    };
  }
  return {
    ...base,
    event: template.eventType,
    source: template.id === "jobber-job-completed" ? "jobber" : "zapier",
  };
}

export default function WebhookSetupWizard() {
  const [settings, setSettings] = useState<WebhookSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [includeOptOut, setIncludeOptOut] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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

  useEffect(() => {
    try {
      const savedStep = localStorage.getItem(WIZARD_STEP_KEY);
      const savedTemplate = localStorage.getItem(WIZARD_TEMPLATE_KEY);
      if (savedStep) {
        const idx = STEPS.findIndex((s) => s.id === savedStep);
        if (idx >= 0) setStepIndex(idx);
      }
      if (savedTemplate) setSelectedTemplateId(savedTemplate);
    } catch {
      // Ignore storage failures
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WIZARD_STEP_KEY, STEPS[stepIndex].id);
      if (selectedTemplateId) {
        localStorage.setItem(WIZARD_TEMPLATE_KEY, selectedTemplateId);
      }
    } catch {
      // Ignore storage failures
    }
  }, [stepIndex, selectedTemplateId, hydrated]);

  const reviewTemplates = useMemo(() => {
    const fromApi = (settings?.zapierTemplates ?? []).filter(
      (t) => t.id !== "customer-opt-out"
    );
    return [...fromApi, CUSTOM_TEMPLATE];
  }, [settings?.zapierTemplates]);

  const optOutTemplate = useMemo(
    () => (settings?.zapierTemplates ?? []).find((t) => t.id === "customer-opt-out"),
    [settings?.zapierTemplates]
  );

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return (
      reviewTemplates.find((t) => t.id === selectedTemplateId) ??
      (selectedTemplateId === "customer-opt-out" ? optOutTemplate : null)
    );
  }, [selectedTemplateId, reviewTemplates, optOutTemplate]);

  const currentStep = STEPS[stepIndex];

  async function updateSettings(
    patch: Partial<Pick<WebhookSettings, "autoSend" | "delayHours" | "triggerEvents">> & {
      rotateToken?: boolean;
      privateFeedbackUrl?: string | null;
    }
  ) {
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
              privateFeedbackUrl: data.privateFeedbackUrl,
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

  function goNext() {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }

  function restartWizard() {
    setStepIndex(0);
    setShowAdvanced(false);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5f6368]">Loading integration setup…</p>
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

  const tailoredPayload = selectedTemplate
    ? buildSamplePayload(selectedTemplate, settings.samplePayload)
    : settings.samplePayload;

  const zapierSteps =
    selectedTemplate && settings.webhookUrl
      ? getSetupSteps(selectedTemplate, settings.webhookUrl)
      : (settings.zapierSteps ?? []);

  return (
    <div className="rounded-xl border border-[#dadce0] bg-white shadow-sm">
      <div className="border-b border-[#e8eaed] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#202124]">Connect your field service tool</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#5f6368]">
              A guided setup for Jobber, Housecall Pro, QuickBooks, or any tool via Zapier/Make.
              We&apos;ll walk you through copying your webhook URL and wiring up review requests.
            </p>
          </div>
          {stepIndex === STEPS.length - 1 && (
            <button
              type="button"
              onClick={restartWizard}
              className="text-sm font-semibold text-[#1a73e8] hover:underline"
            >
              Start over
            </button>
          )}
        </div>

        <div className="mt-5">
          <div className="flex gap-1">
            {STEPS.map((step, i) => (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (i <= stepIndex || (i === 1 && selectedTemplateId)) {
                    setStepIndex(i);
                  }
                }}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-[#1a73e8]" : "bg-[#e8eaed]"
                }`}
                title={step.label}
                aria-label={`Step ${i + 1}: ${step.label}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f0fe] text-sm font-bold text-[#1a73e8]">
              {stepIndex + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-[#202124]">{currentStep.label}</p>
              <p className="text-xs text-[#80868b]">
                Step {stepIndex + 1} of {STEPS.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {currentStep.id === "tool" && (
          <div className="space-y-4">
            <p className="text-sm text-[#5f6368]">
              Which tool sends you job or invoice events? Pick one — we&apos;ll tailor the Zapier
              instructions in a later step.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {reviewTemplates.map((template) => {
                const selected = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-[#1a73e8] bg-[#e8f0fe] ring-2 ring-[#1a73e8]/20"
                        : "border-[#dadce0] bg-white hover:border-[#1a73e8]/50 hover:bg-[#f8f9fa]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" aria-hidden>
                        {TOOL_ICONS[template.id] ?? "🔗"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#202124]">{template.label}</p>
                        <p className="mt-1 text-sm text-[#5f6368]">{template.description}</p>
                        <p className="mt-2 text-xs text-[#80868b]">
                          Triggers on <code className="text-[11px]">{template.eventType}</code>
                        </p>
                      </div>
                      {selected && (
                        <span className="shrink-0 rounded-full bg-[#1a73e8] px-2 py-0.5 text-xs font-semibold text-white">
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {optOutTemplate && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#dadce0] bg-[#f8f9fa] p-4">
                <input
                  type="checkbox"
                  checked={includeOptOut}
                  onChange={(e) => setIncludeOptOut(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-[#202124]">
                    {TOOL_ICONS["customer-opt-out"]} Also set up SMS opt-out handling
                  </p>
                  <p className="mt-1 text-sm text-[#5f6368]">{optOutTemplate.description}</p>
                </div>
              </label>
            )}
          </div>
        )}

        {currentStep.id === "settings" && (
          <div className="space-y-5">
            <p className="text-sm text-[#5f6368]">
              Choose when review requests go out after a job or invoice event hits your webhook.
            </p>

            {settings.auditHasReviewGap === false && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Your audit shows review count is healthy. Auto-send stays off unless you turn it
                on here or send <code className="text-xs">sendReviewRequest: true</code> in each
                webhook payload.
              </div>
            )}

            {settings.auditHasReviewGap && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Your audit recommends more Google reviews — enabling auto-send is a strong fit
                when jobs complete.
              </div>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-[#dadce0] p-4">
              <input
                type="checkbox"
                checked={settings.autoSend}
                disabled={saving}
                onChange={(e) => void updateSettings({ autoSend: e.target.checked })}
                className="mt-1"
              />
              <div>
                <p className="font-semibold text-[#202124]">Auto-send review requests</p>
                <p className="mt-1 text-sm text-[#5f6368]">
                  When enabled,{" "}
                  <code className="text-xs">{settings.triggerEvents.join(", ")}</code> events
                  automatically queue an SMS. Otherwise only payloads with{" "}
                  <code className="text-xs">sendReviewRequest: true</code> send.
                </p>
              </div>
            </label>

            <div>
              <label className="text-sm font-semibold text-[#3c4043]">Send delay</label>
              <p className="mt-1 text-sm text-[#5f6368]">
                Delayed sends improve conversion — customers reply better after the job sinks in.
              </p>
              <select
                value={settings.delayHours}
                disabled={saving}
                onChange={(e) => void updateSettings({ delayHours: Number(e.target.value) })}
                className="mt-2 w-full max-w-sm rounded-lg border border-[#dadce0] px-3 py-2.5 text-sm"
              >
                <option value={0}>Send immediately</option>
                <option value={1}>1 hour after event</option>
                <option value={2}>2 hours after event</option>
                <option value={4}>4 hours after event</option>
                <option value={24}>24 hours after event</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#3c4043]">
                Private feedback URL{" "}
                <span className="font-normal text-[#80868b]">(optional)</span>
              </label>
              <p className="mt-1 text-sm text-[#5f6368]">
                Unhappy customers with <code className="text-xs">sentiment: negative</code> get
                this link instead of a Google review ask.
              </p>
              <input
                type="url"
                defaultValue={settings.privateFeedbackUrl ?? ""}
                placeholder="https://forms.google.com/..."
                className="mt-2 w-full rounded-lg border border-[#dadce0] px-3 py-2.5 text-sm"
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value !== (settings.privateFeedbackUrl ?? "")) {
                    void updateSettings({ privateFeedbackUrl: value || null });
                  }
                }}
              />
            </div>
          </div>
        )}

        {currentStep.id === "webhook" && (
          <div className="space-y-4">
            <p className="text-sm text-[#5f6368]">
              This is your unique webhook URL. You&apos;ll paste it into Zapier (or Make) in the
              next step — keep it private like a password.
            </p>
            <div className="rounded-xl border-2 border-dashed border-[#1a73e8]/30 bg-[#e8f0fe]/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a73e8]">
                Your webhook URL
              </p>
              <code className="mt-2 block break-all text-sm text-[#202124]">
                {settings.webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyText("url", settings.webhookUrl)}
                className="btn-primary mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                {copied === "url" ? "✓ Copied to clipboard" : "Copy webhook URL"}
              </button>
            </div>
            <p className="text-xs text-[#80868b]">
              Tip: copy now so it&apos;s ready when you configure the Webhooks POST action in
              Zapier.
            </p>
          </div>
        )}

        {currentStep.id === "zapier" && selectedTemplate && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[#202124]">Set up {selectedTemplate.label}</p>
                <p className="mt-1 text-sm text-[#5f6368]">
                  Follow these steps in Zapier. Your webhook URL is included below each step that
                  needs it.
                </p>
              </div>
              <a
                href={selectedTemplate.templateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#ff4f00] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e64800]"
              >
                Open in Zapier
                <span aria-hidden>↗</span>
              </a>
            </div>

            <ol className="space-y-3">
              {zapierSteps.map((step, i) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-3 text-sm text-[#3c4043]"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-lg border border-[#dadce0] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
                Fields to map
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTemplate.sampleFields.map((field) => (
                  <code
                    key={field}
                    className="rounded-md bg-[#f1f3f4] px-2 py-1 text-xs text-[#3c4043]"
                  >
                    {field}
                  </code>
                ))}
              </div>
            </div>

            {includeOptOut && optOutTemplate && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-950">SMS opt-out Zap (optional second Zap)</p>
                <p className="mt-1 text-sm text-amber-900">{optOutTemplate.description}</p>
                <a
                  href={optOutTemplate.templateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-amber-950 underline"
                >
                  Open opt-out template in Zapier
                </a>
              </div>
            )}
          </div>
        )}

        {currentStep.id === "done" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-900">You&apos;re almost done</p>
              <p className="mt-1 text-sm text-emerald-800">
                Send a test payload from Zapier, then check the Outreach activity section below
                for incoming events. When a real job completes, customers will be added and review
                requests will send based on your preferences.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#3c4043]">Sample test payload</p>
              <p className="mt-1 text-sm text-[#5f6368]">
                Use this JSON in Zapier&apos;s &quot;Test&quot; step or with curl. Event:{" "}
                <code className="text-xs">{selectedTemplate?.eventType ?? "job.completed"}</code>
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#f8f9fa] p-3 text-xs text-[#3c4043]">
                {JSON.stringify(tailoredPayload, null, 2)}
              </pre>
              <button
                type="button"
                onClick={() =>
                  void copyText("payload", JSON.stringify(tailoredPayload, null, 2))
                }
                className="mt-2 text-sm font-semibold text-[#1a73e8] hover:underline"
              >
                {copied === "payload" ? "Copied" : "Copy sample payload"}
              </button>
            </div>

            {includeOptOut && settings.optOutSamplePayload && (
              <div>
                <p className="text-sm font-semibold text-[#3c4043]">Opt-out test payload</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[#f8f9fa] p-3 text-xs text-[#3c4043]">
                  {JSON.stringify(settings.optOutSamplePayload, null, 2)}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      "optout",
                      JSON.stringify(settings.optOutSamplePayload, null, 2)
                    )
                  }
                  className="mt-2 text-sm font-semibold text-[#1a73e8] hover:underline"
                >
                  {copied === "optout" ? "Copied" : "Copy opt-out payload"}
                </button>
              </div>
            )}

            <div className="rounded-lg border border-[#dadce0] bg-[#f8f9fa] p-4 text-sm text-[#5f6368]">
              <p className="font-medium text-[#202124]">Quick reference</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  Trigger events: {settings.triggerEvents.join(", ")} — or{" "}
                  <code className="text-xs">sendReviewRequest: true</code> per payload
                </li>
                <li>Auto-send: {settings.autoSend ? "On" : "Off"}</li>
                <li>
                  Delay:{" "}
                  {settings.delayHours === 0
                    ? "Immediate"
                    : `${settings.delayHours} hour${settings.delayHours === 1 ? "" : "s"}`}
                </li>
                {selectedTemplate && (
                  <li>Integration: {selectedTemplate.label}</li>
                )}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-sm font-semibold text-[#5f6368] hover:text-[#202124]"
            >
              {showAdvanced ? "Hide advanced options" : "Show advanced options"}
            </button>

            {showAdvanced && (
              <div className="space-y-3 rounded-lg border border-[#dadce0] p-4">
                <p className="text-sm text-[#5f6368]">
                  Rotating your token invalidates the old URL — update every Zap that uses it.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void updateSettings({ rotateToken: true })}
                  className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-white disabled:opacity-50"
                >
                  Rotate webhook token
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8eaed] px-6 py-4">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="rounded-full border border-[#dadce0] px-5 py-2.5 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa] disabled:opacity-40"
        >
          Back
        </button>

        {stepIndex < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={currentStep.id === "tool" && !selectedTemplateId}
            className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void copyText("url", settings.webhookUrl)}
            className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold text-white"
          >
            {copied === "url" ? "URL copied" : "Copy URL & finish"}
          </button>
        )}
      </div>
    </div>
  );
}
