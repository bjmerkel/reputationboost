import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Sign In | Reputation Boost",
  description: "Sign in to access your Google Business Profile audit dashboard.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="marketing-theme min-h-screen bg-[#f8f9fa]">
      <Navbar />
      <main className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-16">
        <Suspense fallback={<div className="text-[#5f6368]">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
