"use client";

import { useEffect, useRef, useState } from "react";
import { isMapsAutocompleteAvailable, loadGoogleMaps, MAPS_SETUP_HELP } from "@/lib/google/maps-loader";

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
}

interface GoogleBusinessAutocompleteProps {
  onSelect: (place: BusinessPlaceSelection) => void;
  onClear?: () => void;
}

function component(type: string, components: google.maps.GeocoderAddressComponent[]): string {
  const match = components.find((c) => c.types.includes(type));
  return match?.long_name ?? match?.short_name ?? "";
}

function industryFromTypes(types: string[]): string {
  const skip = new Set(["point_of_interest", "establishment", "geocode", "political"]);
  const category = types.find((t) => !skip.has(t));
  return category ? category.replace(/_/g, " ") : "local business";
}

function parsePlace(place: google.maps.places.PlaceResult): BusinessPlaceSelection | null {
  if (!place.place_id || !place.geometry?.location) return null;

  const components = place.address_components ?? [];
  const streetNumber = component("street_number", components);
  const route = component("route", components);
  const street = [streetNumber, route].filter(Boolean).join(" ");

  return {
    placeId: place.place_id,
    mapsUrl: place.url,
    name: place.name ?? "",
    address: street || component("premise", components) || place.name || "",
    city:
      component("locality", components) ||
      component("sublocality", components) ||
      component("administrative_area_level_2", components),
    state: component("administrative_area_level_1", components),
    zip: component("postal_code", components),
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng(),
    phone: place.formatted_phone_number,
    website: place.website,
    industry: industryFromTypes(place.types ?? []),
    formattedAddress: place.formatted_address ?? "",
  };
}

export default function GoogleBusinessAutocomplete({
  onSelect,
  onClear,
}: GoogleBusinessAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BusinessPlaceSelection | null>(null);

  useEffect(() => {
    if (!isMapsAutocompleteAvailable() || !inputRef.current) {
      setError("Google Maps API key not configured.");
      return;
    }

    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !inputRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["establishment"],
          fields: [
            "place_id",
            "name",
            "formatted_address",
            "address_components",
            "geometry",
            "website",
            "formatted_phone_number",
            "types",
            "url",
          ],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const parsed = parsePlace(place);
          if (!parsed) {
            setError("Could not read that place. Try another result.");
            return;
          }
          setError(null);
          setSelected(parsed);
          onSelect(parsed);
        });

        autocompleteRef.current = autocomplete;
        setReady(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load Google Autocomplete");
      });

    return () => {
      cancelled = true;
      autocompleteRef.current = null;
    };
  }, [onSelect]);

  function handleClear() {
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  }

  if (!isMapsAutocompleteAvailable()) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Add <code className="text-amber-100">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to Vercel.{" "}
        {MAPS_SETUP_HELP}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">
          Find your business on Google Maps
        </label>
        <input
          ref={inputRef}
          type="text"
          placeholder="Start typing your business name…"
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          {ready
            ? "Powered by Google Places — select your listing from the dropdown."
            : "Loading Google Autocomplete…"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-300">
          <p>{error}</p>
          {error.includes("not enabled") && (
            <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-red-200/90">
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
                  Places API
                </a>{" "}
                → Enable
              </li>
              <li>
                Ensure <code className="text-red-100">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in
                Vercel matches that project (referrer-restricted to your domain)
              </li>
            </ol>
          )}
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-white">{selected.name}</p>
              <p className="mt-1 text-sm text-slate-400">{selected.formattedAddress}</p>
              {selected.industry && (
                <p className="mt-1 text-xs text-emerald-400/80">{selected.industry}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-xs text-slate-400 hover:text-white"
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
