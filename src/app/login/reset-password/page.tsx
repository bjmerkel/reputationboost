import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Set New Password | Reputation Boost",
  description: "Choose a new password for your Reputation Boost account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="marketing-theme min-h-screen bg-[#f8f9fa]">
      <Navbar />
      <main className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-16">
        <Suspense fallback={<div className="text-[#5f6368]">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
