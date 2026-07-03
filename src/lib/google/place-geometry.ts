/** Resolve lat/lng for a Google place_id via the Maps JavaScript PlacesService. */
export function getPlaceGeometry(
  placeId: string,
  map: google.maps.Map
): Promise<google.maps.LatLngLiteral | null> {
  return new Promise((resolve) => {
    const service = new google.maps.places.PlacesService(map);
    service.getDetails(
      { placeId, fields: ["geometry"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const loc = place.geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          resolve(null);
        }
      }
    );
  });
}
