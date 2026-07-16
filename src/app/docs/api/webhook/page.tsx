import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Webhook API | Reputation Boost",
  description:
    "API documentation for the Reputation Boost inbound webhook used by Zapier and field service integrations.",
};

export default function WebhookApiDocsPage() {
  return (
    <div className="marketing-theme min-h-screen bg-[#f8f9fa]">
      <Navbar />
      <main className="py-12 pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1a73e8]">
            Integrations API
          </p>
          <h1 className="mt-2 text-4xl font-normal text-[#202124]">Inbound Webhook</h1>
          <p className="mt-4 text-sm text-[#80868b]">
            Version 1.0.0 ·{" "}
            <a
              href="/openapi/webhook.json"
              className="text-[#1a73e8] hover:underline"
            >
              OpenAPI JSON
            </a>
          </p>

          <div className="mt-10 space-y-8 text-[#5f6368]">
            <p>
              POST customer and job events to Reputation Boost from Zapier, Make, Jobber,
              Housecall Pro, QuickBooks, or any system that can send JSON over HTTPS. Each
              business receives a unique webhook URL from{" "}
              <strong className="text-[#202124]">Customers → Connect your field service tool</strong>.
            </p>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Endpoint</h2>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-4 text-sm text-[#3c4043] shadow-sm ring-1 ring-[#dadce0]">
{`POST https://reputationboost.vercel.app/api/integrations/webhook?token=wb_<your_token>
Content-Type: application/json`}
              </pre>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Authentication</h2>
              <p className="mt-3">Provide the per-business webhook token using one of:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>Query string: <code className="text-sm">?token=wb_...</code> (recommended for Zapier)</li>
                <li>Header: <code className="text-sm">X-Webhook-Token: wb_...</code></li>
                <li>Header: <code className="text-sm">Authorization: Bearer wb_...</code></li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Request body</h2>
              <p className="mt-3">Required fields: <code className="text-sm">event</code>, <code className="text-sm">phone</code> (10-digit US).</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-4 text-sm text-[#3c4043] shadow-sm ring-1 ring-[#dadce0]">
{`{
  "event": "job.completed",
  "phone": "2145550100",
  "firstName": "Jane",
  "lastName": "Doe",
  "service": "water heater install",
  "serviceDate": "2026-07-05",
  "externalId": "job-12345",
  "source": "zapier",
  "sendReviewRequest": true
}`}
              </pre>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Event types</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li><code className="text-sm">job.completed</code> — job finished; may send review request</li>
                <li><code className="text-sm">invoice.paid</code> — invoice paid; may send review request</li>
                <li><code className="text-sm">customer.opted_out</code> — honor STOP/unsubscribe (<code className="text-sm">optedOut: true</code>)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Success response (200)</h2>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-4 text-sm text-[#3c4043] shadow-sm ring-1 ring-[#dadce0]">
{`{
  "ok": true,
  "customerId": "uuid",
  "eventId": "uuid",
  "eventType": "job.completed",
  "reviewRequestSent": false,
  "reviewRequestScheduled": true,
  "scheduledAt": "2026-07-15T18:00:00.000Z"
}`}
              </pre>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Errors</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li><strong>401</strong> — missing or invalid token</li>
                <li><strong>400</strong> — missing <code className="text-sm">event</code> or <code className="text-sm">phone</code></li>
                <li><strong>500</strong> — invalid phone number or processing error</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-medium text-[#202124]">Zapier integration</h2>
              <p className="mt-3">
                Use the Reputation Boost Zapier app actions <strong>Job Completed</strong>,{" "}
                <strong>Invoice Paid</strong>, and <strong>Mark Customer Opted Out</strong>.
                Authenticate with your full webhook URL from the Reputation Boost dashboard.
              </p>
            </section>
          </div>

          <p className="mt-10 text-sm">
            <Link href="/" className="text-[#1a73e8] hover:underline">
              ← Back to homepage
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
