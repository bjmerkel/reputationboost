"use client";

import { useState } from "react";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setMessage("Check your email for a password reset link.");
    setLoading(false);
  }

  return (
    <div className="maps-card w-full max-w-md overflow-hidden">
      <div className="p-8">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center">
            <AppLogo className="h-12 w-auto" />
          </Link>
          <p className="mt-4 text-sm text-[#5f6368]">
            Enter your account email and we&apos;ll send a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#3c4043]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sent}
              className="w-full rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[#202124] placeholder:text-[#80868b] focus:border-[#1a73e8] focus:outline-none focus:ring-1 focus:ring-[#1a73e8] disabled:bg-[#f8f9fa]"
              placeholder="you@business.com"
            />
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.includes("Check your email") ? "text-[#188038]" : "text-[#d93025]"
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || sent}
            className="btn-primary w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Sending…" : sent ? "Email sent" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#80868b]">
          <Link href="/login" className="text-[#1a73e8] hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
