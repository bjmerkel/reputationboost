import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CustomersTabNav from "@/components/customers/CustomersTabNav";
import ProfileGuidePanel from "@/components/customers/ProfileGuidePanel";
import ReviewRequestsPanel from "@/components/customers/ReviewRequestsPanel";
import { getActiveBusiness } from "@/lib/business/active-business";
import { CUSTOMERS_TABS, parseCustomersTab } from "@/lib/customers/tabs";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { isResendConfigured } from "@/lib/email/resend";
import { isTwilioConfigured } from "@/lib/sms/twilio";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customers | Reputation Boost",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ businessId?: string; tab?: string }>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const user = await getUser();
  if (!user) redirect("/login?next=/platform/customers");

  const params = await searchParams;
  const business = await getActiveBusiness(user.id, params.businessId);
  if (!business) {
    redirect("/platform/onboard");
  }

  const activeTab = parseCustomersTab(params.tab);
  const activeTabMeta = CUSTOMERS_TABS.find((tab) => tab.id === activeTab)!;

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

  const auditHref = business.businessId
    ? `/platform/audit?businessId=${business.businessId}`
    : "/platform/audit";

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#f8f9fa] py-8 lg:py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link
          href={auditHref}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#5f6368] transition-colors hover:text-[#202124]"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-6">
          <span className="text-sm font-semibold uppercase tracking-widest text-[#1a73e8]">
            Customers
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[#202124] sm:text-4xl">
            {activeTabMeta.label}
          </h1>
          <p className="mt-3 max-w-2xl text-[#5f6368]">{activeTabMeta.description}</p>
          <p className="mt-2 text-sm text-[#80868b]">
            Active location: <span className="font-medium text-[#3c4043]">{business.name}</span>
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-[#dadce0] bg-white shadow-sm">
          <CustomersTabNav activeTab={activeTab} businessId={business.businessId} />
        </div>

        {activeTab === "review-requests" ? (
          <ReviewRequestsPanel
            businessName={business.name}
            reviewUrl={reviewUrl}
            twilioConfigured={isTwilioConfigured()}
            resendConfigured={isResendConfigured()}
          />
        ) : (
          <ProfileGuidePanel
            businessName={business.name}
            placeId={business.gbpPlaceId}
            mapsUrl={business.gbpMapsUrl}
            website={business.website}
            phone={business.phone}
            address={address}
          />
        )}
      </div>
    </main>
  );
}
