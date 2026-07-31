import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPrimaryBusiness, listUserBusinesses } from "@/audit/businesses";
import OnboardingWizard, {
  type ConnectedGoogleAccount,
} from "@/components/OnboardingWizard";
import type { RankedGbpLocation } from "@/lib/google/gbp-onboarding-match";
import { listGbpTokenSources } from "@/lib/google/gbp-import";
import { getPlatformViewerContext } from "@/lib/admin/platform-context";

export const metadata: Metadata = {
  title: "Onboard | Reputation Boost",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    step?: string;
    businessId?: string;
    sourceBusinessId?: string;
    locations?: string;
    error?: string;
    disconnected?: string;
    change?: string;
    add?: string;
    import?: string;
  }>;
}

export default async function OnboardPage({ searchParams }: PageProps) {
  const ctx = await getPlatformViewerContext();
  if (!ctx) redirect("/login?next=/platform/onboard");

  if (ctx.isImpersonating) {
    const query = ctx.impersonationBusinessId
      ? `?businessId=${encodeURIComponent(ctx.impersonationBusinessId)}`
      : "";
    redirect(`/platform/audit${query}`);
  }

  const params = await searchParams;
  const existing = await getPrimaryBusiness(ctx.viewerUserId);
  const addingLocation = params.add === "1" || params.change === "1";
  const rows = await listUserBusinesses(ctx.viewerUserId);
  const connectedAccounts: ConnectedGoogleAccount[] = listGbpTokenSources(rows);
  const hasConnectedAccounts = connectedAccounts.length > 0;

  if (existing?.onboardingComplete && !params.step && !params.disconnected && !addingLocation) {
    redirect("/platform/audit");
  }

  let locations: RankedGbpLocation[] = [];
  if (params.locations) {
    try {
      locations = JSON.parse(
        Buffer.from(params.locations, "base64url").toString("utf8")
      ) as RankedGbpLocation[];
    } catch {
      locations = [];
    }
  }

  let step: "method" | "business" | "connect" | "location" | "import-account" | "import" =
    "business";

  if (params.step === "import" && params.sourceBusinessId) {
    step = "import";
  } else if (params.step === "import-account") {
    step = "import-account";
  } else if (params.step === "location" && params.businessId) {
    step = "location";
  } else if (addingLocation && hasConnectedAccounts && !params.businessId && params.import === "1") {
    step = "import-account";
  } else if (addingLocation && hasConnectedAccounts && !params.businessId && !params.step) {
    step = "method";
  } else if (addingLocation && !params.businessId && !params.step) {
    step = "business";
  } else if (
    params.businessId ||
    (existing?.businessId && !existing.onboardingComplete && !addingLocation)
  ) {
    step = "connect";
  } else {
    step = "business";
  }

  const wizardBusinessId = addingLocation
    ? params.businessId
    : params.businessId ??
      (existing?.businessId && !existing.onboardingComplete ? existing.businessId : undefined);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto py-6">
      <div className="shrink-0 px-4 pb-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#202124]">
          {addingLocation ? "Add a location" : "Connect your business"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5f6368]">
          {addingLocation
            ? hasConnectedAccounts
              ? "Import from a connected Google account or search Google Maps. Each location can use its own Google login when needed."
              : "Search Google Maps for your new location. Your existing locations stay active while you set this one up."
            : "Search Google Maps, confirm your location, and link your Google Business Profile for live audits and optimization."}
        </p>
      </div>

      <div className="min-h-0 flex-1 px-4 sm:px-6">
        <OnboardingWizard
          step={step}
          businessId={wizardBusinessId}
          locations={locations}
          connectedAccounts={connectedAccounts}
          sourceBusinessId={params.sourceBusinessId}
          error={params.error}
          disconnected={params.disconnected === "1"}
          addingLocation={addingLocation}
          theme="light"
        />
      </div>
    </main>
  );
}
