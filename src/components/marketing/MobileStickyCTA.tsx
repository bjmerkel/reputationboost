"use client";

import { useEffect, useState } from "react";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

export default function MobileStickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const nearBottom = scrollY + windowHeight > docHeight - 200;
      setVisible(scrollY > 500 && !nearBottom);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 p-4 backdrop-blur-lg transition-transform duration-300 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      aria-hidden={!visible}
    >
      <a
        href={SIGNUP_URL}
        className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white"
      >
        {SIGNUP_CTA_LABEL}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    </div>
  );
}
