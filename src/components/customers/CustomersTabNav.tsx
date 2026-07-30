"use client";

import Link from "next/link";
import {
  CUSTOMERS_TABS,
  customersTabHref,
  type CustomersTabId,
} from "@/lib/customers/tabs";

interface CustomersTabNavProps {
  activeTab: CustomersTabId;
  businessId?: string | null;
}

export default function CustomersTabNav({ activeTab, businessId }: CustomersTabNavProps) {
  return (
    <nav
      aria-label="Customer tools"
      className="flex gap-0 overflow-x-auto border-b border-[#dadce0] scroll-smooth"
    >
      {CUSTOMERS_TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <Link
            key={tab.id}
            href={customersTabHref(tab.id, businessId)}
            className={`relative shrink-0 px-4 py-3 text-sm font-medium transition ${
              isActive
                ? "text-[#1a73e8] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-[#1a73e8]"
                : "text-[#5f6368] hover:text-[#3c4043]"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
