import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrimaryBusiness } from "@/audit/businesses";
import CustomersPageClient from "@/components/customers/CustomersPageClient";
import OutreachActivityPanel from "@/components/customers/OutreachActivityPanel";
import WebhookIntegrationPanel from "@/components/customers/WebhookIntegrationPanel";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { isTwilioConfigured } from "@/lib/sms/twilio";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customers | Reputation Boost",
  robots: { index: false, follow: false },
};

export default async function CustomersPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/platform/customers");

  const business = await getPrimaryBusiness(user.id);
  if (!business) {
    redirect("/platform/onboard");
  }

  const address = [
    business.location.address,
    business.location.city,
    business.location.state,
    business.location.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const reviewUrl = googleReviewUrlForBusiness({
    placeId: business.gbpPlaceId,
    mapsUrl: business.gbpMapsUrl,
    name: business.name,
    address,
  });

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#f8f9fa] py-8 lg:py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link
          href="/platform/audit"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#5f6368] transition-colors hover:text-[#202124]"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-8">
          <span className="text-sm font-semibold uppercase tracking-widest text-[#1a73e8]">
            Review requests
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[#202124] sm:text-4xl">
            Customer outreach
          </h1>
          <p className="mt-3 max-w-2xl text-[#5f6368]">
            Import your customer list, personalize a Google review request, and send it by SMS —
            the fastest path to more 5-star reviews.
          </p>
        </div>

        <div className="space-y-6">
          <WebhookIntegrationPanel />
          <OutreachActivityPanel />
          <CustomersPageClient
          businessName={business.name}
          reviewUrl={reviewUrl}
          twilioConfigured={isTwilioConfigured()}
          />
        </div>
      </div>
    </main>
  );
}
