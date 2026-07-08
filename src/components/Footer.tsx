import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import { SIGNUP_URL, SIGNUP_CTA_LABEL, SUPPORT_EMAIL } from "@/lib/constants";

const footerLinks = {
  Product: [
    { label: "Get Started", href: "/#hero-search" },
    { label: "How It Works", href: "/#nightly-score" },
    { label: "Revenue Calculator", href: "/#roi-calculator" },
    { label: "Pricing", href: "/#pricing" },
    { label: SIGNUP_CTA_LABEL, href: SIGNUP_URL },
  ],
  Company: [
    { label: "How It Works", href: "/#nightly-score" },
    { label: "What We Track", href: "/#what-we-track" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contact", href: `mailto:${SUPPORT_EMAIL}` },
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
            <Link href="/" className="inline-flex items-center">
              <AppLogo className="h-10 w-auto" />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#5f6368]">
              We score your Google Business Profile, build your action plan, and
              prove the revenue — so you know exactly where you stand and what
              to fix next.
            </p>
            <p className="mt-4 text-sm text-[#5f6368]">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#1a73e8] hover:underline">
                {SUPPORT_EMAIL}
              </a>
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
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm text-[#5f6368] transition-colors hover:text-[#1a73e8]"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
