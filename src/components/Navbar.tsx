"use client";

import { useState } from "react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#cta" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="glass mx-4 mt-4 rounded-2xl px-6 py-4 lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500">
              <svg
                className="h-5 w-5 text-white"
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
            <span className="text-lg font-bold tracking-tight text-white">
              Reputation Boost
            </span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#cta"
              className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            >
              Sign In
            </a>
            <a
              href="#cta"
              className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            >
              Get Started Free
            </a>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 md:hidden"
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
          <div className="mt-4 flex flex-col gap-4 border-t border-white/10 pt-4 md:hidden">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-300"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <a
                href="#cta"
                className="btn-secondary rounded-full px-5 py-2.5 text-center text-sm font-semibold text-white"
              >
                Sign In
              </a>
              <a
                href="#cta"
                className="btn-primary rounded-full px-5 py-2.5 text-center text-sm font-semibold text-white"
              >
                Get Started Free
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
