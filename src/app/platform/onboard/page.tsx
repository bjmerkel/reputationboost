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
  }>;
}

export default async function OnboardPage({ searchParams }: PageProps) {
  const user = await getUser();
  if (!user) redirect("/login?next=/platform/onboard");

  const params = await searchParams;
  const existing = await getPrimaryBusiness(user.id);

  if (existing?.onboardingComplete && !params.step && !params.disconnected) {
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

  const step =
    params.step === "location" && params.businessId
      ? "location"
      : params.businessId || (existing?.businessId && !existing.onboardingComplete)
        ? "connect"
        : "business";

  const wizardBusinessId =
    params.businessId ?? (existing?.businessId && !existing.onboardingComplete ? existing.businessId : undefined);

  return (
    <main className="relative overflow-hidden py-10">
      <div className="mesh-bg absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Get Started
          </span>
          <h1 className="mt-2 text-4xl font-extrabold text-white">
            Connect your business
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Link your Google Business Profile to unlock live audits, AI strategy,
            and automated execution.
          </p>
        </div>

        <OnboardingWizard
          step={step}
          businessId={wizardBusinessId}
          locations={locations}
          error={params.error}
          disconnected={params.disconnected === "1"}
        />
      </div>
    </main>
  );
}
