import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPrimaryBusiness } from "@/audit/businesses";
import OnboardingWizard from "@/components/OnboardingWizard";
import type { GbpLocationOption } from "@/lib/google/gbp-accounts";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Onboard | Reputation Boost",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    step?: string;
    businessId?: string;
    locations?: string;
    error?: string;
    disconnected?: string;
    change?: string;
  }>;
}

export default async function OnboardPage({ searchParams }: PageProps) {
  const user = await getUser();
  if (!user) redirect("/login?next=/platform/onboard");

  const params = await searchParams;
  const existing = await getPrimaryBusiness(user.id);
  const changingBusiness = params.change === "1";

  if (existing?.onboardingComplete && !params.step && !params.disconnected && !changingBusiness) {
    redirect("/platform/audit");
  }

  let locations: GbpLocationOption[] = [];
  if (params.locations) {
    try {
      locations = JSON.parse(
        Buffer.from(params.locations, "base64url").toString("utf8")
      ) as GbpLocationOption[];
    } catch {
      locations = [];
    }
  }

  const step = changingBusiness
    ? "business"
    : params.step === "location" && params.businessId
      ? "location"
      : params.businessId || (existing?.businessId && !existing.onboardingComplete)
        ? "connect"
        : "business";

  const wizardBusinessId = changingBusiness
    ? undefined
    : params.businessId ??
      (existing?.businessId && !existing.onboardingComplete ? existing.businessId : undefined);

  return (
    <main className="flex min-h-0 flex-1 flex-col py-6">
      <div className="shrink-0 px-4 pb-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#202124]">Connect your business</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5f6368]">
          Search Google Maps, confirm your location, and link your Google Business Profile for
          live audits and optimization.
        </p>
      </div>

      <div className="min-h-0 flex-1 px-4 sm:px-6">
        <OnboardingWizard
          step={step}
          businessId={wizardBusinessId}
          locations={locations}
          error={params.error}
          disconnected={params.disconnected === "1"}
          changingBusiness={changingBusiness}
          theme="light"
        />
      </div>
    </main>
  );
}
