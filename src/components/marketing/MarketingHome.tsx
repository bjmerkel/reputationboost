"use client";

import { PreviewAuditProvider } from "@/context/PreviewAuditContext";

export default function MarketingHome({ children }: { children: React.ReactNode }) {
  return <PreviewAuditProvider>{children}</PreviewAuditProvider>;
}
