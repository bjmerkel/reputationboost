import Link from "next/link";
import type { AdminUserBusinessPreview } from "@/lib/admin/types";

const MAX_VISIBLE = 3;

export default function BusinessListCell({
  businesses,
  onboardedCount,
  businessCount,
  gbpConnectedCount,
}: {
  businesses: AdminUserBusinessPreview[];
  onboardedCount: number;
  businessCount: number;
  gbpConnectedCount: number;
}) {
  if (businesses.length === 0) {
    return <span className="text-[#64748b]">No businesses</span>;
  }

  const visible = businesses.slice(0, MAX_VISIBLE);
  const hiddenCount = businesses.length - visible.length;

  return (
    <div className="min-w-[200px] space-y-1.5">
      {visible.map((business) => (
        <div key={business.id} className="leading-snug">
          <Link
            href={`/admin/businesses/${business.id}`}
            className="font-medium text-[#e2e8f0] hover:text-[#a5b4fc]"
          >
            {business.name}
          </Link>
          <p className="text-xs text-[#64748b]">
            {[
              business.location || null,
              business.score !== null ? `Score ${business.score}` : null,
              business.gbpConnected ? "GBP" : business.onboardingComplete ? "Onboarded" : "Setup",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ))}
      {hiddenCount > 0 ? (
        <p className="text-xs text-[#64748b]">+{hiddenCount} more location{hiddenCount === 1 ? "" : "s"}</p>
      ) : null}
      <p className="text-xs text-[#475569]">
        {onboardedCount}/{businessCount} onboarded · {gbpConnectedCount} GBP
      </p>
    </div>
  );
}
