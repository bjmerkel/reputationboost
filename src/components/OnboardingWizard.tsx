"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GbpLocationOption } from "@/lib/google/gbp-accounts";
import GoogleBusinessAutocomplete, {
  type BusinessPlaceSelection,
} from "@/components/GoogleBusinessAutocomplete";
import { KeywordSuggestions } from "@/components/KeywordSuggestions";
import RankingMap from "@/components/platform/RankingMap";

interface OnboardingWizardProps {
  step: "business" | "connect" | "location";
  businessId?: string;
  locations?: GbpLocationOption[];
  error?: string;
  disconnected?: boolean;
  changingBusiness?: boolean;
  theme?: "light" | "dark";
}

export default function OnboardingWizard({
  step: initialStep,
  businessId: initialBusinessId,
  locations = [],
  error,
  disconnected,
  changingBusiness = false,
  theme = "dark",
}: OnboardingWizardProps) {
  const isLight = theme === "light";
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [businessId, setBusinessId] = useState(initialBusinessId ?? "");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(error ?? "");

  const [placeSelected, setPlaceSelected] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);

  function handlePlaceSelect(place: BusinessPlaceSelection) {
    setPlaceSelected(true);
    setPlaceId(place.placeId);
    setMapsUrl(place.mapsUrl ?? "");
    setName(place.name);
    setIndustry(place.industry);
    setAddress(place.address);
    setCity(place.city);
    setState(place.state);
    setZip(place.zip);
    setLat(place.lat);
    setLng(place.lng);
    if (place.phone) setPhone(place.phone);
    if (place.website) setWebsite(place.website);
    setKeywords([]);
    setFormError("");
  }

  function handlePlaceClear() {
    setPlaceSelected(false);
    setPlaceId("");
    setMapsUrl("");
    setName("");
    setIndustry("");
    setAddress("");
    setCity("");
    setState("");
    setZip("");
    setLat(0);
    setLng(0);
    setKeywords([]);
  }

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!placeSelected || !name.trim()) {
      setFormError("Search and select your business from Google Maps first.");
      return;
    }
    if (keywords.length < 3) {
      setFormError("Select at least 3 target keywords for rank tracking.");
      return;
    }

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
          lat,
          lng,
          placeId,
          mapsUrl,
          phone,
          website,
          keywords,
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

  function skipGbpForLater() {
    router.push("/platform/audit?skipped_gbp=1");
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
    <div className={isLight ? "mx-auto max-w-6xl" : "mx-auto max-w-xl"}>
      <div className="mb-8 flex gap-2">
        {(["business", "connect", "location"] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              step === s || (step === "location" && s !== "business")
                ? isLight
                  ? "bg-[#1a73e8]"
                  : "bg-emerald-400"
                : isLight
                  ? "bg-[#dadce0]"
                  : "bg-white/10"
            }`}
            title={`Step ${i + 1}`}
          />
        ))}
      </div>

      {(formError || error) && (
        <p
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            isLight
              ? "border-[#f6aea9] bg-[#fce8e6] text-[#c5221f]"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {formError || error}
        </p>
      )}

      {disconnected && (
        <p
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            isLight
              ? "border-[#ceead6] bg-[#e6f4ea] text-[#137333]"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          Google Business Profile disconnected. Reconnect below to resume live audits.
        </p>
      )}

      {step === "business" && (
        <div
          className={
            placeSelected && lat && lng && isLight
              ? "flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#dadce0] bg-white lg:flex-row"
              : ""
          }
        >
          <form
            onSubmit={createBusiness}
            className={`space-y-4 ${
              placeSelected && lat && lng && isLight
                ? "w-full shrink-0 overflow-y-auto p-6 lg:w-[420px]"
                : ""
            }`}
          >
          <h2
            className={`text-2xl font-bold ${isLight ? "text-[#202124]" : "text-white"}`}
          >
            {changingBusiness ? "Change your business" : "Add your business"}
          </h2>
          <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            {changingBusiness
              ? "Search for a different business on Google Maps. You'll connect its Google Business Profile in the next steps."
              : "Search for your business on Google Maps. Next you'll connect your Google Business Profile for live data."}
          </p>

          <GoogleBusinessAutocomplete
            onSelect={handlePlaceSelect}
            onClear={handlePlaceClear}
          />

          {placeSelected && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" value={name} onChange={setName} required light={isLight} />
                <Field
                  label="Industry / category"
                  value={industry}
                  onChange={setIndustry}
                  required
                  light={isLight}
                />
              </div>
              <Field label="Street address" value={address} onChange={setAddress} required light={isLight} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City" value={city} onChange={setCity} required light={isLight} />
                <Field label="State" value={state} onChange={setState} required light={isLight} />
                <Field label="ZIP" value={zip} onChange={setZip} required light={isLight} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" value={phone} onChange={setPhone} light={isLight} />
                <Field label="Website" value={website} onChange={setWebsite} light={isLight} />
              </div>

              <KeywordSuggestions
                businessName={name}
                industry={industry}
                address={address}
                city={city}
                state={state}
                zip={zip}
                website={website}
                selected={keywords}
                onChange={setKeywords}
                disabled={loading}
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading || !placeSelected || keywords.length < 3}
            className="btn-primary w-full rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>

          {placeSelected && lat && lng && isLight && (
            <div className="min-h-[280px] flex-1 border-t border-[#dadce0] lg:min-h-0 lg:border-t-0 lg:border-l">
              <RankingMap
                lat={lat}
                lng={lng}
                address={`${address}, ${city}, ${state} ${zip}`}
                businessName={name}
              />
            </div>
          )}
        </div>
      )}

      {step === "connect" && (
        <div className={`mx-auto max-w-xl space-y-6 ${isLight ? "" : ""}`}>
          <h2 className={`text-2xl font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Connect Google Business Profile
          </h2>
          <p className={`text-sm leading-relaxed ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Sign in with the Google account that manages your business on Google Maps.
            We&apos;ll pull live profile data, reviews, posts, and performance metrics.
          </p>

          <ul className={`space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
            <li>✓ Performance: profile views, calls, directions, website clicks, search keywords</li>
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

          <button
            type="button"
            onClick={skipGbpForLater}
            className={`w-full rounded-full py-3 text-sm font-medium transition ${
              isLight
                ? "text-[#5f6368] hover:text-[#202124]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Skip for later
          </button>
          <p className={`text-center text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            You can connect anytime from Settings. Live audits require a GBP link.
          </p>
        </div>
      )}

      {step === "location" && (
        <div className="mx-auto max-w-xl space-y-4">
          <h2 className={`text-2xl font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Select your location
          </h2>
          <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Your Google account manages multiple locations. Choose the one to optimize.
          </p>

          {locations.map((loc) => (
            <button
              key={`${loc.accountId}-${loc.locationId}`}
              type="button"
              disabled={loading}
              onClick={() => selectLocation(loc)}
              className={`w-full rounded-xl border p-4 text-left transition disabled:opacity-50 ${
                isLight
                  ? "border-[#dadce0] bg-white hover:border-[#1a73e8] hover:bg-[#f8f9fa]"
                  : "border-white/10 bg-white/[0.03] hover:border-emerald-500/40 hover:bg-white/[0.05]"
              }`}
            >
              <p className={`font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                {loc.title}
              </p>
              <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {loc.address}
              </p>
              <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>{loc.primaryCategory}</p>
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
  light = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  light?: boolean;
}) {
  return (
    <div>
      <label
        className={`mb-1.5 block text-sm font-medium ${
          light ? "text-[#3c4043]" : "text-slate-300"
        }`}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none ${
          light
            ? "border-[#dadce0] bg-white text-[#202124] placeholder:text-[#80868b] focus:border-[#1a73e8]"
            : "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-emerald-500/50"
        }`}
      />
      {hint && (
        <p className={`mt-1 text-xs ${light ? "text-[#80868b]" : "text-slate-500"}`}>{hint}</p>
      )}
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
