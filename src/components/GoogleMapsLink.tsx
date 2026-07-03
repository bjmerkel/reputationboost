import { googleMapsUrlForBusiness } from "@/lib/google/maps-url";

export default function GoogleMapsLink({
  mapsUrl,
  name,
  address,
  className = "text-sm font-semibold text-emerald-400 hover:text-emerald-300",
  label = "View on Google Maps",
}: {
  mapsUrl?: string | null;
  name?: string;
  address?: string;
  className?: string;
  label?: string;
}) {
  const href = googleMapsUrlForBusiness({ mapsUrl, name, address });
  if (!href) return null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}
