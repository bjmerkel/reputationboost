import Link from "next/link";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

const footerLinks = {
  Product: [
    { label: "Reputation Boost Score", href: "/#reputation-score" },
    { label: "Keyword Intelligence", href: "/#features" },
    { label: "Action Plan", href: "/#action-plan" },
    { label: "Results & Attribution", href: "/#results" },
    { label: "Revenue Calculator", href: "/#roi-calculator" },
    { label: "Pricing", href: "/#pricing" },
    { label: SIGNUP_CTA_LABEL, href: SIGNUP_URL },
  ],
  Company: [
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Testimonials", href: "/#testimonials" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contact", href: "mailto:info@reputationboost.com" },
    { label: "Local 3-Pack", href: "/#local-pack" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-[#dadce0] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a73e8]">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                  />
                </svg>
              </div>
              <span className="font-semibold text-[#202124]">Reputation Boost</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#5f6368]">
              We score your Google Business Profile, build your action plan, and
              prove the revenue — so you know exactly where you stand and what
              to fix next.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-[#202124]">{category}</h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#5f6368] transition-colors hover:text-[#1a73e8]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#dadce0] pt-8 sm:flex-row">
          <p className="text-sm text-[#80868b]">
            &copy; {new Date().getFullYear()} Reputation Boost. All rights reserved.
          </p>
          <a
            href="mailto:info@reputationboost.com"
            className="text-sm text-[#5f6368] transition-colors hover:text-[#1a73e8]"
          >
            info@reputationboost.com
          </a>
        </div>
      </div>
    </footer>
  );
}
