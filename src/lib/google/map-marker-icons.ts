/**
 * Google Maps–style marker icons and default map options.
 * Requires the Maps JS API to be loaded before calling factory functions.
 */

/** Classic Google Maps red pin SVG path (24×24 viewBox). */
const PIN_PATH =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";

export function createBusinessPinIcon(
  google: typeof globalThis.google
): google.maps.Symbol {
  return {
    path: PIN_PATH,
    fillColor: "#ea4335",
    fillOpacity: 1,
    strokeColor: "#c5221f",
    strokeWeight: 1,
    scale: 1.6,
    anchor: new google.maps.Point(12, 22),
  };
}

export function createCompetitorMarkerIcon(
  google: typeof globalThis.google
): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 12,
    fillColor: "#1a73e8",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

export function createGoogleMapOptions(
  google: typeof globalThis.google,
  center: google.maps.LatLngLiteral,
  zoom = 13
): google.maps.MapOptions {
  return {
    center,
    zoom,
    mapTypeControl: false,
    streetViewControl: true,
    fullscreenControl: true,
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_CENTER,
    },
    streetViewControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
    fullscreenControlOptions: {
      position: google.maps.ControlPosition.RIGHT_TOP,
    },
    gestureHandling: "greedy",
    clickableIcons: false,
    disableDefaultUI: false,
  };
}
