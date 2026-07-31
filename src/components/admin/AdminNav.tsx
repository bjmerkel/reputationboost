"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Command Center", exact: true },
  { href: "/admin/users", label: "Users", exact: false },
  { href: "/admin/outreach", label: "Outreach", exact: false },
  { href: "/admin/scores", label: "Scores", exact: false },
  { href: "/admin/operations", label: "Operations", exact: false },
  { href: "/admin/tasks", label: "Tasks", exact: false },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-[#1e2433] text-white"
                : "text-[#94a3b8] hover:bg-[#1e2433] hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
