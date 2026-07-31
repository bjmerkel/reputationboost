"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReviewCampaignPlanCard from "@/components/review-requests/ReviewCampaignPlanCard";
import ReviewCampaignDashboard from "@/components/customers/ReviewCampaignDashboard";
import BulkOutreachCampaignPanel from "@/components/customers/BulkOutreachCampaignPanel";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import { REVIEW_REQUEST_COOLDOWN_DAYS } from "@/lib/review-requests/eligibility";
import { IMMEDIATE_SEND_BATCH_MAX } from "@/lib/review-requests/bulk-config";
import type { OutreachChannel } from "@/lib/review-requests/channel";
import { channelDescription, channelLabel } from "@/lib/review-requests/channel";
import type { ReviewCampaignPlan } from "@/lib/review-requests/campaign-plan";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  service_notes: string | null;
  last_service_date: string | null;
  opted_out: boolean;
  review_requested_at: string | null;
  created_at: string;
}

function isEligibleCustomer(customer: Customer): boolean {
  if (customer.opted_out) return false;
  if (!customer.review_requested_at) return true;
  const days = Math.floor(
    (Date.now() - new Date(customer.review_requested_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return days >= REVIEW_REQUEST_COOLDOWN_DAYS;
}

function isReachableForChannel(customer: Customer, channel: OutreachChannel): boolean {
  if (!isEligibleCustomer(customer)) return false;
  if (channel === "email") return Boolean(customer.email?.trim());
  if (channel === "sms") return Boolean(customer.phone?.trim());
  return Boolean(customer.email?.trim() || customer.phone?.trim());
}

interface CustomersPageProps {
  businessName: string;
  reviewUrl: string | null;
  twilioConfigured: boolean;
  resendConfigured: boolean;
}

const CHANNELS: OutreachChannel[] = ["auto", "email", "sms"];
const CUSTOMERS_PAGE_SIZE = 50;

function formatPhone(phone: string | null): string {
  if (!phone?.trim()) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function customerName(c: Customer): string {
  const first = c.first_name.trim();
  const last = c.last_name.trim();
  if (first && last) return `${first} ${last}`;
  return first || last || "Customer";
}

export default function CustomersPageClient({
  businessName,
  reviewUrl,
  twilioConfigured,
  resendConfigured,
}: CustomersPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<OutreachChannel>("auto");
  const [template, setTemplate] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState("");
  const [smsPreview, setSmsPreview] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [emailEligibleCount, setEmailEligibleCount] = useState(0);
  const [batchSize, setBatchSize] = useState(15);
  const [matchedCustomers, setMatchedCustomers] = useState(0);
  const [focusKeyword, setFocusKeyword] = useState<string | null>(null);
  const [campaignPlan, setCampaignPlan] = useState<ReviewCampaignPlan | null>(null);
  const [campaignRefreshKey, setCampaignRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [customerPage, setCustomerPage] = useState(0);
  const [campaignPreview, setCampaignPreview] = useState<{
    eligible: number;
    smsCount: number;
    emailCount: number;
    estimatedDays: number;
    dailySendCap: number;
    skipped: Record<string, number>;
  } | null>(null);
  const [campaignPreviewLoading, setCampaignPreviewLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    serviceNotes: "",
  });

  const eligibleCustomers = useMemo(
    () => customers.filter((customer) => isReachableForChannel(customer, channel)),
    [customers, channel]
  );

  const loadCustomers = useCallback(async (page?: number) => {
    const targetPage = page ?? customerPage;
    setLoading(true);
    setError(null);
    try {
      const offset = targetPage * CUSTOMERS_PAGE_SIZE;
      const res = await fetch(
        `/api/customers?limit=${CUSTOMERS_PAGE_SIZE}&offset=${offset}`
      );
      const data = await parseJsonResponse<{ customers: Customer[]; total: number; error?: string }>(
        res
      );
      if (!res.ok) throw new Error(data.error ?? "Failed to load customers");
      setCustomers(data.customers);
      setTotal(data.total);
      setCustomerPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [customerPage]);

  const loadMessageTemplate = useCallback(
    async (keywordOverride?: string | null, channelOverride?: OutreachChannel) => {
      const activeChannel = channelOverride ?? channel;
      try {
        const res = await fetch("/api/review-requests/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            focusKeyword: keywordOverride ?? focusKeyword ?? null,
            channel: activeChannel,
          }),
        });
        const data = await parseJsonResponse<{
          channel: OutreachChannel;
          template: string;
          smsTemplate?: string;
          subject?: string;
          preview: string;
          smsPreview?: string;
          previewHtml?: string | null;
          eligibleCount: number;
          emailEligibleCount?: number;
          matchedCustomers: number;
          batchSize: number;
          focusKeyword: string | null;
          campaignPlan: ReviewCampaignPlan | null;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to generate message");
        setTemplate(data.template);
        setSmsTemplate(data.smsTemplate ?? "");
        setSubject(data.subject ?? "");
        setPreview(data.preview);
        setSmsPreview(data.smsPreview ?? "");
        setPreviewHtml(data.previewHtml ?? null);
        setEligibleCount(data.eligibleCount);
        setEmailEligibleCount(data.emailEligibleCount ?? 0);
        setMatchedCustomers(data.matchedCustomers);
        setBatchSize(data.batchSize);
        setFocusKeyword(data.focusKeyword);
        setCampaignPlan(data.campaignPlan);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate message");
      }
    },
    [channel, focusKeyword]
  );

  useEffect(() => {
    void loadCustomers(0);
    void loadMessageTemplate();
  }, [loadMessageTemplate]);

  const loadCampaignPreview = useCallback(async () => {
    const sendCount =
      selectedIds.size > 0 ? selectedIds.size : eligibleCustomers.length;
    if (sendCount <= IMMEDIATE_SEND_BATCH_MAX) {
      setCampaignPreview(null);
      return;
    }

    setCampaignPreviewLoading(true);
    try {
      const customerIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const res = await fetch("/api/review-requests/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          template,
          smsTemplate: channel === "auto" ? smsTemplate : undefined,
          subject: channel === "sms" ? undefined : subject,
          customerIds,
          focusKeyword,
        }),
      });
      const data = await parseJsonResponse<{
        eligible: number;
        smsCount: number;
        emailCount: number;
        estimatedDays: number;
        dailySendCap: number;
        skipped?: Record<string, number>;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setCampaignPreview({
        eligible: data.eligible,
        smsCount: data.smsCount,
        emailCount: data.emailCount,
        estimatedDays: data.estimatedDays,
        dailySendCap: data.dailySendCap,
        skipped: data.skipped ?? {},
      });
    } catch {
      setCampaignPreview(null);
    } finally {
      setCampaignPreviewLoading(false);
    }
  }, [
    channel,
    eligibleCustomers.length,
    focusKeyword,
    selectedIds,
    smsTemplate,
    subject,
    template,
  ]);

  useEffect(() => {
    void loadCampaignPreview();
  }, [loadCampaignPreview]);

  async function handleChannelChange(nextChannel: OutreachChannel) {
    setChannel(nextChannel);
    setSelectedIds(new Set());
    await loadMessageTemplate(focusKeyword, nextChannel);
  }

  async function pollImportJob(jobId: string): Promise<void> {
    const maxAttempts = 120;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`/api/customers/import/${jobId}`);
      const data = await parseJsonResponse<{
        job?: {
          status: string;
          processedRows: number;
          totalRows: number;
          importedCount: number;
          updatedCount: number;
          failedCount: number;
          errorMessage?: string | null;
        };
        error?: string;
      }>(res);

      if (!res.ok) throw new Error(data.error ?? "Failed to load import status");

      const job = data.job;
      if (!job) throw new Error("Import job not found");

      const progressLabel =
        job.totalRows > 0
          ? `Importing… ${job.processedRows.toLocaleString()} / ${job.totalRows.toLocaleString()} rows processed`
          : "Importing…";
      setImportProgress(progressLabel);

      if (job.status === "completed") {
        const parts = [
          `${job.importedCount} imported`,
          job.updatedCount ? `${job.updatedCount} updated` : null,
          job.failedCount ? `${job.failedCount} failed` : null,
        ].filter(Boolean);
        setSendResult(`Import complete: ${parts.join(", ")}`);
        setImportProgress(null);
        await loadCustomers(0);
        await loadMessageTemplate();
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.errorMessage ?? "Import failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error("Import is still running. Refresh the page to check progress.");
  }

  async function handleCsvImport(file: File) {
    setImporting(true);
    setError(null);
    setSendResult(null);
    setImportProgress(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const data = await parseJsonResponse<{
        async?: boolean;
        jobId?: string;
        imported?: number;
        updated?: number;
        failed?: number;
        parseErrors?: string[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      if (data.async && data.jobId) {
        setSendResult("Large import queued. Processing in the background…");
        await pollImportJob(data.jobId);
        return;
      }

      const parts = [
        `${data.imported ?? 0} imported`,
        data.updated ? `${data.updated} updated` : null,
        data.failed ? `${data.failed} failed` : null,
      ].filter(Boolean);

      setSendResult(`Import complete: ${parts.join(", ")}`);
      await loadCustomers(0);
      await loadMessageTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImportProgress(null);
    } finally {
      setImporting(false);
    }
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newCustomer.phone.trim() && !newCustomer.email.trim()) {
      setError("Enter a phone number or email address.");
      return;
    }
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to add customer");

      setNewCustomer({ firstName: "", lastName: "", phone: "", email: "", serviceNotes: "" });
      setShowAddForm(false);
      await loadCustomers();
      await loadMessageTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add customer");
    }
  }

  async function handleDelete(customerId: string) {
    if (!confirm("Remove this customer from your list?")) return;
    try {
      const res = await fetch(`/api/customers?id=${customerId}`, { method: "DELETE" });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(customerId);
        return next;
      });
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllEligible() {
    setSelectedIds(new Set(eligibleCustomers.map((c) => c.id)));
  }

  async function handleSend(dryRun: boolean) {
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const customerIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const sendCount = customerIds?.length ?? eligibleCustomers.length;
      const useCampaign = !dryRun && sendCount > IMMEDIATE_SEND_BATCH_MAX;

      const endpoint = useCampaign
        ? "/api/review-requests/campaigns"
        : "/api/review-requests/send";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          template,
          smsTemplate: channel === "auto" ? smsTemplate : undefined,
          subject: channel === "sms" ? undefined : subject,
          customerIds,
          batchSize: selectedIds.size > 0 ? selectedIds.size : batchSize,
          focusKeyword,
          dryRun,
          mode: useCampaign ? "campaign" : "immediate",
        }),
      });
      const data = await parseJsonResponse<{
        sent?: number;
        failed?: number;
        skipped?: number;
        simulated?: boolean;
        channel?: OutreachChannel;
        mode?: string;
        campaign?: { id: string; status: string; queuedSmsCount: number; queuedEmailCount: number };
        preview?: { eligible: number; estimatedDays: number; smsCount: number; emailCount: number };
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Send failed");

      if (data.mode === "campaign" || data.campaign) {
        const sms = data.campaign?.queuedSmsCount ?? data.preview?.smsCount ?? 0;
        const email = data.campaign?.queuedEmailCount ?? data.preview?.emailCount ?? 0;
        const days = data.preview?.estimatedDays ?? 1;
        setSendResult(
          `Queued campaign for ${data.preview?.eligible ?? sendCount} customers (${sms} SMS, ${email} email). Sending over ~${days} day${days === 1 ? "" : "s"}.`
        );
        setCampaignRefreshKey((k) => k + 1);
        await loadCustomers(0);
        return;
      }

      const channelName =
        data.channel === "auto" ? "outreach" : data.channel === "email" ? "email" : "SMS";

      if (dryRun) {
        setSendResult(`Preview ready for ${customerIds?.length ?? Math.min(batchSize, eligibleCustomers.length)} customer(s).`);
      } else if (data.simulated) {
        setSendResult(
          `Simulated ${data.sent} ${channelName} message(s). Add provider credentials to send for real.`
        );
      } else {
        setSendResult(
          `Sent ${data.sent} ${channelName} review request${data.sent === 1 ? "" : "s"}${data.failed ? ` (${data.failed} failed)` : ""}.`
        );
      }

      if (!dryRun) {
        setSelectedIds(new Set());
        await loadCustomers(0);
        await loadMessageTemplate(focusKeyword);
        setCampaignRefreshKey((key) => key + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const showEmailEditor = channel === "email" || channel === "auto";
  const showSmsEditor = channel === "sms" || channel === "auto";
  const messageReady =
    template.trim() &&
    (channel === "email" || (channel === "auto" ? smsTemplate.trim() : true));
  const demoMode =
    (channel === "sms" && !twilioConfigured) ||
    (channel === "email" && !resendConfigured) ||
    (channel === "auto" && !twilioConfigured && !resendConfigured);

  return (
    <div className="space-y-6">
      {demoMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Demo mode:</strong>{" "}
          {channel === "auto"
            ? "Outreach will be simulated until you add Twilio and/or Resend credentials."
            : channel === "email"
              ? "Emails will be simulated until you add RESEND_API_KEY and RESEND_FROM_EMAIL."
              : "SMS will be simulated until you add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER."}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {sendResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {sendResult}
        </div>
      )}

      <ReviewCampaignDashboard
        key={campaignRefreshKey}
        onFocusKeyword={(keyword) => {
          setFocusKeyword(keyword);
          void loadMessageTemplate(keyword);
        }}
      />

      <BulkOutreachCampaignPanel refreshKey={campaignRefreshKey} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#202124]">Import customers</h2>
          <p className="mt-2 text-sm text-[#5f6368]">
            Upload a CSV with columns like <code className="text-xs">first_name</code>,{" "}
            <code className="text-xs">last_name</code>, <code className="text-xs">phone</code>,{" "}
            <code className="text-xs">email</code>, <code className="text-xs">service</code>.
            Include at least one of <code className="text-xs">phone</code> or{" "}
            <code className="text-xs">email</code> per row. Lists with 500+ rows import in the
            background automatically.
          </p>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#dadce0] bg-[#f8f9fa] px-6 py-8 transition hover:border-[#1a73e8] hover:bg-[#e8f0fe]">
            <span className="text-sm font-semibold text-[#1a73e8]">
              {importing ? "Importing…" : "Choose CSV file"}
            </span>
            <span className="mt-1 text-xs text-[#80868b]">or drag and drop</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsvImport(file);
              }}
            />
          </label>

          {importProgress && (
            <p className="mt-3 text-sm text-[#5f6368]">{importProgress}</p>
          )}

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="mt-4 text-sm font-semibold text-[#1a73e8] hover:underline"
          >
            {showAddForm ? "Cancel" : "+ Add customer manually"}
          </button>

          {showAddForm && (
            <form onSubmit={handleAddCustomer} className="mt-4 space-y-3 border-t border-[#dadce0] pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="First name"
                  value={newCustomer.firstName}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, firstName: e.target.value }))}
                  className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
                />
                <input
                  placeholder="Last name"
                  value={newCustomer.lastName}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, lastName: e.target.value }))}
                  className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                className="w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              />
              <input
                placeholder="Email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                className="w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              />
              <p className="text-xs text-[#80868b]">Provide at least a phone number or email.</p>
              <input
                placeholder="Service (e.g. water heater install)"
                value={newCustomer.serviceNotes}
                onChange={(e) => setNewCustomer((c) => ({ ...c, serviceNotes: e.target.value }))}
                className="w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-full bg-[#1a73e8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1765cc]"
              >
                Save customer
              </button>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#202124]">Review request campaign</h2>
            <div className="inline-flex rounded-full border border-[#dadce0] bg-[#f8f9fa] p-1">
              {CHANNELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void handleChannelChange(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    channel === value
                      ? "bg-white text-[#1a73e8] shadow-sm"
                      : "text-[#5f6368] hover:text-[#202124]"
                  }`}
                >
                  {channelLabel(value)}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-sm text-[#5f6368]">{channelDescription(channel)}</p>

          {campaignPlan && (
            <div className="mt-4">
              <ReviewCampaignPlanCard
                plan={campaignPlan}
                eligibleCount={eligibleCount}
                matchedCustomers={matchedCustomers}
                selectedKeyword={focusKeyword}
                onSelectKeyword={(keyword) => void loadMessageTemplate(keyword)}
              />
            </div>
          )}

          {showEmailEditor && (
            <>
              <h3 className="mt-6 text-sm font-bold text-[#202124]">Email subject</h3>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
              />

              <h3 className="mt-6 text-sm font-bold text-[#202124]">Email message</h3>
              <p className="mt-2 text-sm text-[#5f6368]">
                Personalized for <strong>{businessName}</strong>. Use{" "}
                <code className="text-xs">[FIRST_NAME]</code>,{" "}
                <code className="text-xs">[SERVICE]</code>,{" "}
                <code className="text-xs">[BUSINESS]</code>, and{" "}
                <code className="text-xs">[REVIEW_LINK]</code>.
              </p>

              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={7}
                className="mt-4 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm leading-relaxed"
              />

              {preview && (
                <div className="mt-3 rounded-lg bg-[#f8f9fa] px-3 py-2 text-sm text-[#3c4043]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
                    Email preview
                  </span>
                  {previewHtml ? (
                    <iframe
                      title="Email preview"
                      srcDoc={previewHtml}
                      className="mt-2 h-72 w-full rounded-lg border border-[#dadce0] bg-white"
                      sandbox=""
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap">{preview}</p>
                  )}
                </div>
              )}
            </>
          )}

          {showSmsEditor && (
            <>
              <h3 className="mt-6 text-sm font-bold text-[#202124]">SMS message</h3>
              <p className="mt-2 text-sm text-[#5f6368]">
                Personalized for <strong>{businessName}</strong>. Use{" "}
                <code className="text-xs">[FIRST_NAME]</code>,{" "}
                <code className="text-xs">[SERVICE]</code>,{" "}
                <code className="text-xs">[BUSINESS]</code>, and{" "}
                <code className="text-xs">[REVIEW_LINK]</code>.
              </p>

              <textarea
                value={channel === "sms" ? template : smsTemplate}
                onChange={(e) =>
                  channel === "sms" ? setTemplate(e.target.value) : setSmsTemplate(e.target.value)
                }
                rows={5}
                className="mt-4 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm leading-relaxed"
              />

              {(channel === "sms" ? preview : smsPreview) && (
                <div className="mt-3 rounded-lg bg-[#f8f9fa] px-3 py-2 text-sm text-[#3c4043]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
                    SMS preview
                  </span>
                  <p className="mt-1 whitespace-pre-wrap">
                    {channel === "sms" ? preview : smsPreview}
                  </p>
                </div>
              )}
            </>
          )}

          {reviewUrl && (
            <p className="mt-4 truncate text-xs text-[#80868b]">
              Google review link:{" "}
              <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="text-[#1a73e8]">
                {reviewUrl}
              </a>
            </p>
          )}

          {eligibleCustomers.length > IMMEDIATE_SEND_BATCH_MAX && (
            <div className="mt-4 rounded-lg border border-[#e8f0fe] bg-[#e8f0fe]/40 px-4 py-3 text-sm text-[#3c4043]">
              {campaignPreviewLoading ? (
                <p>Calculating campaign spread…</p>
              ) : campaignPreview ? (
                <>
                  <p className="font-semibold text-[#202124]">Bulk campaign preview</p>
                  <p className="mt-1">
                    {campaignPreview.eligible} customers · {campaignPreview.smsCount} SMS ·{" "}
                    {campaignPreview.emailCount} email · ~{campaignPreview.estimatedDays} day
                    {campaignPreview.estimatedDays === 1 ? "" : "s"} at{" "}
                    {campaignPreview.dailySendCap}/day
                  </p>
                </>
              ) : (
                <p>Large send will queue as a spread campaign automatically.</p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sending || !messageReady || eligibleCustomers.length === 0}
              onClick={() => void handleSend(false)}
              className="rounded-full bg-[#1a73e8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50"
            >
              {sending
                ? "Sending…"
                : eligibleCustomers.length > IMMEDIATE_SEND_BATCH_MAX
                  ? `Queue campaign (${selectedIds.size || eligibleCustomers.length} customers)`
                  : `Send batch of ${selectedIds.size || Math.min(batchSize, eligibleCustomers.length)} customer(s)`}
            </button>
            <button
              type="button"
              disabled={sending || !messageReady}
              onClick={() => void loadMessageTemplate(focusKeyword)}
              className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
            >
              Regenerate {channel === "auto" ? "messages" : showSmsEditor ? "SMS" : "email"}
            </button>
          </div>

          <p className="mt-2 text-xs text-[#80868b]">
            {eligibleCustomers.length} reachable via {channelLabel(channel).toLowerCase()}
            {channel === "auto" && emailEligibleCount > 0
              ? ` · ${emailEligibleCount} with email`
              : ""}
            . Campaign suggests batches of {batchSize}. Sends above {IMMEDIATE_SEND_BATCH_MAX}{" "}
            customers queue as a spread campaign automatically.
            {focusKeyword && matchedCustomers > 0 ? ` · ${matchedCustomers} match "${focusKeyword}"` : ""}.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#dadce0] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dadce0] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#202124]">Customer list</h2>
            <p className="text-sm text-[#5f6368]">{total} total</p>
          </div>
          <button
            type="button"
            onClick={selectAllEligible}
            className="text-sm font-semibold text-[#1a73e8] hover:underline"
          >
            Select all eligible on page ({eligibleCustomers.length})
          </button>
        </div>

        {total > CUSTOMERS_PAGE_SIZE && (
          <p className="border-b border-[#dadce0] px-6 py-2 text-xs text-[#80868b]">
            Showing {customerPage * CUSTOMERS_PAGE_SIZE + 1}–
            {Math.min((customerPage + 1) * CUSTOMERS_PAGE_SIZE, total)} of {total} customers
          </p>
        )}

        {loading ? (
          <p className="px-6 py-8 text-sm text-[#5f6368]">Loading customers…</p>
        ) : customers.length === 0 ? (
          <p className="px-6 py-8 text-sm text-[#5f6368]">
            No customers yet. Import a CSV or add one manually to start sending review requests.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8f9fa] text-xs uppercase tracking-wide text-[#80868b]">
                <tr>
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadce0]">
                {customers.map((customer) => {
                  const reachable = isReachableForChannel(customer, channel);
                  return (
                    <tr key={customer.id} className={reachable ? "" : "opacity-60"}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer.id)}
                          disabled={!reachable}
                          onChange={() => toggleSelect(customer.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[#202124]">
                        {customerName(customer)}
                      </td>
                      <td className="px-4 py-3 text-[#5f6368]">{formatPhone(customer.phone)}</td>
                      <td className="px-4 py-3 text-[#5f6368]">{customer.email ?? "—"}</td>
                      <td className="px-4 py-3 text-[#5f6368]">
                        {customer.service_notes ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {customer.review_requested_at ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Requested
                          </span>
                        ) : customer.opted_out ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Opted out
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            Ready
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDelete(customer.id)}
                          className="text-xs text-[#80868b] hover:text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > CUSTOMERS_PAGE_SIZE && !loading && customers.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#dadce0] px-6 py-3">
            <button
              type="button"
              disabled={customerPage === 0}
              onClick={() => void loadCustomers(customerPage - 1)}
              className="text-sm font-semibold text-[#1a73e8] hover:underline disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-[#80868b]">
              Page {customerPage + 1} of {Math.ceil(total / CUSTOMERS_PAGE_SIZE)}
            </span>
            <button
              type="button"
              disabled={(customerPage + 1) * CUSTOMERS_PAGE_SIZE >= total}
              onClick={() => void loadCustomers(customerPage + 1)}
              className="text-sm font-semibold text-[#1a73e8] hover:underline disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
