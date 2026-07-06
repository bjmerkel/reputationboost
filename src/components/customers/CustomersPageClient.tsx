"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  service_notes: string | null;
  last_service_date: string | null;
  opted_out: boolean;
  review_requested_at: string | null;
  created_at: string;
}

interface CustomersPageProps {
  businessName: string;
  reviewUrl: string | null;
  twilioConfigured: boolean;
}

function formatPhone(phone: string): string {
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
}: CustomersPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [template, setTemplate] = useState("");
  const [preview, setPreview] = useState("");
  const [eligibleCount, setEligibleCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    serviceNotes: "",
  });

  const eligibleCustomers = useMemo(
    () => customers.filter((c) => !c.opted_out && !c.review_requested_at),
    [customers]
  );

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers?limit=200");
      const data = await parseJsonResponse<{ customers: Customer[]; total: number; error?: string }>(
        res
      );
      if (!res.ok) throw new Error(data.error ?? "Failed to load customers");
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessageTemplate = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
    void loadMessageTemplate();
  }, [loadCustomers, loadMessageTemplate]);

  async function handleCsvImport(file: File) {
    setImporting(true);
    setError(null);
    setSendResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const data = await parseJsonResponse<{
        imported: number;
        updated: number;
        failed: number;
        parseErrors?: string[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      const parts = [
        `${data.imported} imported`,
        data.updated ? `${data.updated} updated` : null,
        data.failed ? `${data.failed} failed` : null,
      ].filter(Boolean);

      setSendResult(`Import complete: ${parts.join(", ")}`);
      await loadCustomers();
      await loadMessageTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      const res = await fetch("/api/review-requests/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          customerIds,
          batchSize: 15,
          dryRun,
        }),
      });
      const data = await parseJsonResponse<{
        sent: number;
        failed: number;
        skipped: number;
        simulated: boolean;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Send failed");

      if (dryRun) {
        setSendResult(`Preview ready for ${customerIds?.length ?? Math.min(15, eligibleCount)} customer(s).`);
      } else if (data.simulated) {
        setSendResult(
          `Simulated ${data.sent} message(s). Add Twilio credentials to send real texts.`
        );
      } else {
        setSendResult(
          `Sent ${data.sent} review request${data.sent === 1 ? "" : "s"}${data.failed ? ` (${data.failed} failed)` : ""}.`
        );
      }

      if (!dryRun) {
        setSelectedIds(new Set());
        await loadCustomers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {!twilioConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Demo mode:</strong> SMS will be simulated until you add{" "}
          <code className="rounded bg-amber-100 px-1">TWILIO_ACCOUNT_SID</code>,{" "}
          <code className="rounded bg-amber-100 px-1">TWILIO_AUTH_TOKEN</code>, and{" "}
          <code className="rounded bg-amber-100 px-1">TWILIO_FROM_NUMBER</code> to your environment.
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#202124]">Import customers</h2>
          <p className="mt-2 text-sm text-[#5f6368]">
            Upload a CSV with columns like <code className="text-xs">first_name</code>,{" "}
            <code className="text-xs">last_name</code>, <code className="text-xs">phone</code>,{" "}
            <code className="text-xs">email</code>, <code className="text-xs">service</code>.
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
                required
                placeholder="Phone *"
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
          <h2 className="text-lg font-bold text-[#202124]">Review request message</h2>
          <p className="mt-2 text-sm text-[#5f6368]">
            Personalized for <strong>{businessName}</strong>. Use placeholders:{" "}
            <code className="text-xs">[FIRST_NAME]</code>, <code className="text-xs">[SERVICE]</code>,{" "}
            <code className="text-xs">[REVIEW_LINK]</code>.
          </p>

          {reviewUrl && (
            <p className="mt-2 truncate text-xs text-[#80868b]">
              Google review link:{" "}
              <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="text-[#1a73e8]">
                {reviewUrl}
              </a>
            </p>
          )}

          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={5}
            className="mt-4 w-full rounded-lg border border-[#dadce0] px-3 py-2 text-sm leading-relaxed"
          />

          {preview && (
            <div className="mt-3 rounded-lg bg-[#f8f9fa] px-3 py-2 text-sm text-[#3c4043]">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
                Sample preview
              </span>
              <p className="mt-1">{preview}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sending || !template.trim() || eligibleCustomers.length === 0}
              onClick={() => void handleSend(false)}
              className="rounded-full bg-[#1a73e8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50"
            >
              {sending
                ? "Sending…"
                : `Send to ${selectedIds.size || Math.min(15, eligibleCount)} customer(s)`}
            </button>
            <button
              type="button"
              disabled={sending || !template.trim()}
              onClick={() => void loadMessageTemplate()}
              className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
            >
              Regenerate with AI
            </button>
          </div>

          <p className="mt-2 text-xs text-[#80868b]">
            {eligibleCount} eligible (not yet contacted). Select customers below or we send to the next 15.
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
            Select all eligible ({eligibleCustomers.length})
          </button>
        </div>

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
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadce0]">
                {customers.map((customer) => {
                  const eligible = !customer.opted_out && !customer.review_requested_at;
                  return (
                    <tr key={customer.id} className={eligible ? "" : "opacity-60"}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer.id)}
                          disabled={!eligible}
                          onChange={() => toggleSelect(customer.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[#202124]">
                        {customerName(customer)}
                      </td>
                      <td className="px-4 py-3 text-[#5f6368]">{formatPhone(customer.phone)}</td>
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
      </div>
    </div>
  );
}
