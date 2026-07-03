export function googleMapsPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
}

export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleMapsUrlForBusiness(options: {
  placeId?: string | null;
  name?: string;
  address?: string;
}): string | null {
  if (options.placeId) {
    return googleMapsPlaceUrl(options.placeId);
  }

  const query = [options.name, options.address].filter(Boolean).join(", ");
  return query ? googleMapsSearchUrl(query) : null;
}
