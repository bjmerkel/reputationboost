declare global {
  interface Window {
    google?: typeof google;
  }
}

let loadPromise: Promise<typeof google> | null = null;

export function getMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
}

export function isMapsAutocompleteAvailable(): boolean {
  return Boolean(getMapsApiKey());
}

/** Load Google Maps JavaScript API with Places library (client-side). */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (!loadPromise) {
    const key = getMapsApiKey();
    if (!key) {
      return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured."));
    }

    loadPromise = new Promise((resolve, reject) => {
      const callbackName = "__rbMapsInit";
      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        if (window.google?.maps?.places) {
          resolve(window.google);
        } else {
          reject(new Error("Google Places library failed to load."));
        }
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${callbackName}&loading=async`;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Google Maps script."));
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
