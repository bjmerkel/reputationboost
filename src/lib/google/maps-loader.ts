declare global {
  interface Window {
    google?: typeof google;
    gm_authFailure?: () => void;
  }
}

let loadPromise: Promise<typeof google> | null = null;

export const MAPS_SETUP_HELP =
  "Enable Maps JavaScript API and Places API in Google Cloud Console → APIs & Services → Library, then add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to Vercel with HTTP referrer restrictions.";

export const MAPS_NOT_ACTIVATED_ERROR =
  "Maps JavaScript API is not enabled for this API key. In Google Cloud Console, enable: (1) Maps JavaScript API, (2) Places API. Use the same key as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with referrer restrictions for your domain.";

export function getMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
}

export function isMapsAutocompleteAvailable(): boolean {
  return Boolean(getMapsApiKey());
}

/** Load Google Maps JavaScript API (map display; Places optional). */
export function loadGoogleMapsCore(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (!loadPromise) {
    const key = getMapsApiKey();
    if (!key) {
      return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured."));
    }

    loadPromise = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        loadPromise = null;
        reject(new Error(message));
      };

      window.gm_authFailure = () => fail(MAPS_NOT_ACTIVATED_ERROR);

      const callbackName = "__rbMapsInit";
      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        if (settled) return;
        if (window.google?.maps) {
          settled = true;
          resolve(window.google);
        } else {
          fail("Google Maps library failed to load.");
        }
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${callbackName}&loading=async`;
      script.async = true;
      script.onerror = () => fail("Failed to load Google Maps script.");
      document.head.appendChild(script);

      window.setTimeout(() => {
        if (!settled && !window.google?.maps) {
          fail(MAPS_NOT_ACTIVATED_ERROR);
        }
      }, 8000);
    });
  }

  return loadPromise;
}

/** Load Google Maps JavaScript API with Places library (client-side). */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  return loadGoogleMapsCore().then((google) => {
    if (!google.maps?.places) {
      return Promise.reject(new Error("Google Places library failed to load."));
    }
    return google;
  });
}
