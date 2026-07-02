"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GbpLocationOption } from "@/lib/google/gbp-accounts";

interface OnboardingWizardProps {
  step: "business" | "connect" | "location";
  businessId?: string;
  locations?: GbpLocationOption[];
  error?: string;
}

export default function OnboardingWizard({
  step: initialStep,
  businessId: initialBusinessId,
  locations = [],
  error,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [businessId, setBusinessId] = useState(initialBusinessId ?? "");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(error ?? "");

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [keywords, setKeywords] = useState("");

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError("");

    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          industry,
          address,
          city,
          state,
          zip,
          phone,
          website,
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create business");

      setBusinessId(data.business.businessId);
      router.replace(`/platform/onboard?businessId=${data.business.businessId}`);
      setStep("connect");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function connectGoogle() {
    if (!businessId) return;
    window.location.href = `/api/google/gbp/connect?businessId=${businessId}`;
  }

  async function selectLocation(loc: GbpLocationOption) {
    setLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/google/gbp/select-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          accountId: loc.accountId,
          locationId: loc.locationId,
          placeId: loc.placeId,
          title: loc.title,
          phone: loc.phone,
          website: loc.website,
          industry: loc.primaryCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save location");
      router.push("/platform/audit?onboarded=1");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex gap-2">
        {(["business", "connect", "location"] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              step === s || (step === "location" && s !== "business")
                ? "bg-emerald-400"
                : "bg-white/10"
            }`}
            title={`Step ${i + 1}`}
          />
        ))}
      </div>

      {(formError || error) && (
        <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {formError || error}
        </p>
      )}

      {step === "business" && (
        <form onSubmit={createBusiness} className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Add your business</h2>
          <p className="text-sm text-slate-400">
            Tell us about your business. Next you&apos;ll connect your Google Business Profile.
          </p>

          <Field label="Business name" value={name} onChange={setName} required />
          <Field label="Industry / category" value={industry} onChange={setIndustry} required placeholder="e.g. Plumber" />
          <Field label="Street address" value={address} onChange={setAddress} required />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" value={city} onChange={setCity} required />
            <Field label="State" value={state} onChange={setState} required />
            <Field label="ZIP" value={zip} onChange={setZip} required />
          </div>
          <Field label="Phone" value={phone} onChange={setPhone} />
          <Field label="Website" value={website} onChange={setWebsite} />
          <Field
            label="Target keywords"
            value={keywords}
            onChange={setKeywords}
            placeholder="plumber, emergency plumber, drain cleaning"
            hint="Comma-separated — used for Local 3-Pack rank tracking"
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      )}

      {step === "connect" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Connect Google Business Profile</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Sign in with the Google account that manages your business on Google Maps.
            We&apos;ll pull live profile data, reviews, posts, and performance metrics.
          </p>

          <ul className="space-y-2 text-sm text-slate-300">
            <li>✓ Performance: calls, directions, website clicks</li>
            <li>✓ Reviews and response status</li>
            <li>✓ Google Posts and Q&amp;A</li>
            <li>✓ Publish approved content from the execution queue</li>
          </ul>

          <button
            type="button"
            onClick={connectGoogle}
            className="btn-primary flex w-full items-center justify-center gap-3 rounded-full py-3 text-sm font-semibold text-white"
          >
            <GoogleIcon />
            Connect with Google
          </button>
        </div>
      )}

      {step === "location" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Select your location</h2>
          <p className="text-sm text-slate-400">
            Your Google account manages multiple locations. Choose the one to optimize.
          </p>

          {locations.map((loc) => (
            <button
              key={`${loc.accountId}-${loc.locationId}`}
              type="button"
              disabled={loading}
              onClick={() => selectLocation(loc)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-emerald-500/40 hover:bg-white/[0.05] disabled:opacity-50"
            >
              <p className="font-semibold text-white">{loc.title}</p>
              <p className="mt-1 text-sm text-slate-400">{loc.address}</p>
              <p className="mt-1 text-xs text-slate-500">{loc.primaryCategory}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
