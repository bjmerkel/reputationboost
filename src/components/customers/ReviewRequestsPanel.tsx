import CustomersPageClient from "@/components/customers/CustomersPageClient";
import OutreachActivityPanel from "@/components/customers/OutreachActivityPanel";
import WebhookIntegrationPanel from "@/components/customers/WebhookIntegrationPanel";

interface ReviewRequestsPanelProps {
  businessName: string;
  reviewUrl: string | null;
  twilioConfigured: boolean;
  resendConfigured: boolean;
}

export default function ReviewRequestsPanel({
  businessName,
  reviewUrl,
  twilioConfigured,
  resendConfigured,
}: ReviewRequestsPanelProps) {
  return (
    <div className="space-y-6">
      <WebhookIntegrationPanel />
      <OutreachActivityPanel />
      <CustomersPageClient
        businessName={businessName}
        reviewUrl={reviewUrl}
        twilioConfigured={twilioConfigured}
        resendConfigured={resendConfigured}
      />
    </div>
  );
}
