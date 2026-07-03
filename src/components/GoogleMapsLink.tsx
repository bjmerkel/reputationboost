import { googleMapsUrlForBusiness } from "@/lib/google/maps-url";

export default function GoogleMapsLink({
  placeId,
  name,
  address,
  className = "text-sm font-semibold text-emerald-400 hover:text-emerald-300",
  label = "View on Google Maps",
}: {
  placeId?: string | null;
  name?: string;
  address?: string;
  className?: string;
  label?: string;
}) {
  const href = googleMapsUrlForBusiness({ placeId, name, address });
  if (!href) return null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}
