"use client";

import { useEffect, useRef, useState } from "react";
import {
  importPlacesLibrary,
  isMapsAutocompleteAvailable,
  MAPS_SETUP_HELP,
} from "@/lib/google/maps-loader";
import {
  buildBusinessAddress,
  detectServiceAreaBusiness,
  parseCityStateFromAreaText,
  resolveServiceAreaLabel,
} from "@/lib/google/parse-business-place";
import { resolvePrimaryCategoryLabel } from "@/lib/google/place-details";

export interface BusinessPlaceSelection {
  placeId: string;
  mapsUrl?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  industry: string;
  formattedAddress: string;
  isServiceAreaBusiness?: boolean;
}

interface GoogleBusinessAutocompleteProps {
  onSelect: (place: BusinessPlaceSelection) => void;
  onClear?: () => void;
  theme?: "light" | "dark";
  compact?: boolean;
  /** Large hero search — primary homepage CTA */
  hero?: boolean;
}

function componentFromAddress(
  type: string,
  components: google.maps.places.AddressComponent[]
): string {
  const match = components.find((c) => c.types.includes(type));
  return match?.longText ?? match?.shortText ?? "";
}

function normalizePlaceId(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

async function resolveServiceAreaCoordinates(input: {
  placeId: string;
  name: string;
  formattedAddress: string;
  city: string;
  state: string;
}): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch("/api/places/resolve-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: number; lng?: number };
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      return { lat: data.lat, lng: data.lng };
    }
    return null;
  } catch {
    return null;
  }
}

function formatableText(value?: google.maps.places.FormattableText | null): string {
  return value?.text?.trim() ?? "";
}

async function parsePlace(
  place: google.maps.places.Place,
  placePrediction?: google.maps.places.PlacePrediction
): Promise<BusinessPlaceSelection | null> {
  await place.fetchFields({
    fields: [
      "id",
      "displayName",
      "formattedAddress",
      "shortFormattedAddress",
      "addressComponents",
      "location",
      "nationalPhoneNumber",
      "websiteURI",
      "googleMapsURI",
      "types",
      "primaryType",
      "primaryTypeDisplayName",
      "isPureServiceAreaBusiness",
    ],
  });

  const placeId = place.id ? normalizePlaceId(place.id) : "";
  if (!placeId) return null;

  const components = place.addressComponents ?? [];
  const streetNumber = componentFromAddress("street_number", components);
  const route = componentFromAddress("route", components);
  const street = [streetNumber, route].filter(Boolean).join(" ");
  const formattedAddress = place.formattedAddress ?? "";
  const predictionSecondary = formatableText(placePrediction?.secondaryText);
  const serviceAreaLabel = resolveServiceAreaLabel(
    place.shortFormattedAddress,
    formattedAddress,
    predictionSecondary
  );
  const isServiceAreaBusiness = detectServiceAreaBusiness({
    isPureServiceAreaBusiness: place.isPureServiceAreaBusiness,
    hasStreet: Boolean(street),
    serviceAreaLabel,
  });

  let city =
    componentFromAddress("locality", components) ||
    componentFromAddress("sublocality", components) ||
    componentFromAddress("administrative_area_level_2", components);
  let state = componentFromAddress("administrative_area_level_1", components);
  let zip = componentFromAddress("postal_code", components);

  if (!city || !state || (isServiceAreaBusiness && !zip)) {
    const parsed = parseCityStateFromAreaText(serviceAreaLabel || predictionSecondary);
    if (!city && parsed.city) city = parsed.city;
    if (!state && parsed.state) state = parsed.state;
    if (!zip && parsed.zip) zip = parsed.zip;
  }

  let lat = place.location?.lat() ?? 0;
  let lng = place.location?.lng() ?? 0;

  if (isServiceAreaBusiness && (!lat || !lng)) {
    const resolved = await resolveServiceAreaCoordinates({
      placeId,
      name: place.displayName ?? "",
      formattedAddress: serviceAreaLabel || formattedAddress,
      city,
      state,
    });
    if (resolved) {
      lat = resolved.lat;
      lng = resolved.lng;
    }
  }

  const displayAddress = formattedAddress || serviceAreaLabel || predictionSecondary;

  return {
    placeId,
    mapsUrl: place.googleMapsURI ?? undefined,
    name: place.displayName ?? "",
    address: buildBusinessAddress({
      street,
      formattedAddress,
      serviceAreaLabel,
      isServiceAreaBusiness,
    }),
    city,
    state,
    zip,
    lat,
    lng,
    phone: place.nationalPhoneNumber ?? undefined,
    website: place.websiteURI ?? undefined,
    industry: resolvePrimaryCategoryLabel({
      primaryTypeDisplayName: place.primaryTypeDisplayName,
      primaryType: place.primaryType,
      types: place.types,
    }),
    formattedAddress: displayAddress,
    isServiceAreaBusiness,
  };
}

export default function GoogleBusinessAutocomplete({
  onSelect,
  onClear,
  theme = "dark",
  compact = false,
  hero = false,
}: GoogleBusinessAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [ready, setReady] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BusinessPlaceSelection | null>(null);

  useEffect(() => {
    if (!isMapsAutocompleteAvailable() || !containerRef.current) {
      setError("Google Maps API key not configured.");
      return;
    }

    let cancelled = false;
    const container = containerRef.current;
    let cleanupListener: (() => void) | undefined;

    importPlacesLibrary()
      .then(({ PlaceAutocompleteElement }) => {
        if (cancelled || !container) return;

        const autocomplete = new PlaceAutocompleteElement({
          includedPrimaryTypes: ["establishment"],
          includedRegionCodes: ["us"],
          pureServiceAreaBusinessesIncluded: true,
          placeholder: hero
            ? "Search your business on Google Maps"
            : "Start typing your business name…",
          noInputIcon: hero || compact,
        });

        autocomplete.className = [
          "rb-place-autocomplete",
          hero ? "rb-place-autocomplete--hero" : "",
          compact ? "rb-place-autocomplete--compact" : "",
          theme === "light" ? "rb-place-autocomplete--light" : "rb-place-autocomplete--dark",
        ]
          .filter(Boolean)
          .join(" ");

        const handleSelect = async (event: Event) => {
          const { placePrediction } = event as google.maps.places.PlacePredictionSelectEvent;
          setResolving(true);
          setError(null);

          try {
            const place = placePrediction.toPlace();
            const parsed = await parsePlace(place, placePrediction);
            if (!parsed) {
              setError("Could not read that place. Try another result.");
              return;
            }
            setSelected(parsed);
            onSelect(parsed);
          } catch {
            setError("Could not read that place. Try another result.");
          } finally {
            setResolving(false);
          }
        };

        autocomplete.addEventListener("gmp-select", handleSelect);
        container.replaceChildren(autocomplete);
        autocompleteRef.current = autocomplete;
        setReady(true);

        cleanupListener = () => {
          autocomplete.removeEventListener("gmp-select", handleSelect);
        };
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load Google Autocomplete");
      });

    return () => {
      cancelled = true;
      cleanupListener?.();
      autocompleteRef.current = null;
      container.replaceChildren();
    };
  }, [hero, compact, onSelect, theme]);

  function handleClear() {
    setSelected(null);
    setError(null);
    if (autocompleteRef.current) {
      autocompleteRef.current.value = "";
    }
    onClear?.();
  }

  const isLight = theme === "light";

  if (!isMapsAutocompleteAvailable()) {
    return (
      <p
        className={
          isLight
            ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            : "rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        }
      >
        Add{" "}
        <code className={isLight ? "text-amber-900" : "text-amber-100"}>
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{" "}
        to Vercel. {MAPS_SETUP_HELP}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!compact && !hero && (
        <div>
          <label
            className={`mb-1.5 block text-sm font-medium ${
              isLight ? "text-[#202124]" : "text-slate-300"
            }`}
          >
            Find your business on Google Maps
          </label>
          <div ref={containerRef} className="rb-place-autocomplete-host" />
          <p className={`mt-1.5 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {resolving
              ? "Loading business details…"
              : ready
                ? "Powered by Google Places — select your listing from the dropdown. Service-area businesses are supported."
                : "Loading Google Autocomplete…"}
          </p>
        </div>
      )}

      {(compact || hero) && (
        <div className="relative">
          {(hero || compact) && (
            <svg
              className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-[#5f6368] ${
                hero ? "left-5 h-6 w-6" : "left-4 h-5 w-5"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          )}
          <div
            ref={containerRef}
            className={hero ? "rb-place-autocomplete-host rb-place-autocomplete-host--hero" : "rb-place-autocomplete-host"}
          />
        </div>
      )}

      {error && (
        <div
          className={
            isLight
              ? "rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-300"
          }
        >
          <p>{error}</p>
          {error.includes("not enabled") && (
            <ol
              className={`mt-2 list-inside list-decimal space-y-1 text-xs ${
                isLight ? "text-red-600" : "text-red-200/90"
              }`}
            >
              <li>
                Open{" "}
                <a
                  href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Maps JavaScript API
                </a>{" "}
                → Enable
              </li>
              <li>
                Open{" "}
                <a
                  href="https://console.cloud.google.com/apis/library/places-backend.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Places API (New)
                </a>{" "}
                → Enable
              </li>
              <li>
                Ensure{" "}
                <code className={isLight ? "text-red-800" : "text-red-100"}>
                  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                </code>{" "}
                in Vercel matches that project (referrer-restricted to your domain)
              </li>
            </ol>
          )}
        </div>
      )}

      {selected && (
        <div
          className={
            isLight
              ? "rounded-xl border border-[#1a73e8]/30 bg-[#e8f0fe] p-4"
              : "rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                {selected.name}
              </p>
              <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {selected.formattedAddress}
              </p>
              {selected.isServiceAreaBusiness && (
                <p className={`mt-1 text-xs ${isLight ? "text-[#1a73e8]" : "text-emerald-400/80"}`}>
                  Service-area business (no storefront address)
                </p>
              )}
              {selected.industry && (
                <p
                  className={`mt-1 text-xs ${isLight ? "text-[#1a73e8]" : "text-emerald-400/80"}`}
                >
                  {selected.industry}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className={`shrink-0 text-xs ${
                isLight ? "text-[#5f6368] hover:text-[#202124]" : "text-slate-400 hover:text-white"
              }`}
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
