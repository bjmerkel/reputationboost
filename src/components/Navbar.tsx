"use client";

import { useState } from "react";
import Link from "next/link";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

const navLinks = [
  { label: "Platform", href: "/#platform-explorer" },
  { label: "Score", href: "/#your-score" },
  { label: "Money", href: "/#your-money" },
  { label: "Pricing", href: "/#pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#dadce0] bg-white">
      <nav className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
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

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[#5f6368] transition-colors hover:text-[#202124]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="btn-secondary rounded-full px-5 py-2 text-sm font-medium"
            >
              Sign In
            </Link>
            <a
              href={SIGNUP_URL}
              className="btn-primary rounded-full px-5 py-2 text-sm font-medium text-white"
            >
              {SIGNUP_CTA_LABEL}
            </a>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#5f6368] hover:bg-[#f8f9fa] md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <div className="mt-3 flex flex-col gap-3 border-t border-[#dadce0] pt-3 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#3c4043]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/login"
                className="btn-secondary rounded-full px-5 py-2.5 text-center text-sm font-medium"
              >
                Sign In
              </Link>
              <a
                href={SIGNUP_URL}
                className="btn-primary rounded-full px-5 py-2.5 text-center text-sm font-medium text-white"
              >
                {SIGNUP_CTA_LABEL}
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
