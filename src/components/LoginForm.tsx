"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/platform/onboard";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    searchParams.get("error") ? "Authentication failed. Please try again." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setMessage("Check your email for a confirmation link.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="maps-card w-full max-w-md overflow-hidden">
      <div className="p-8">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center">
            <AppLogo className="h-12 w-auto" />
          </Link>
          <p className="mt-4 text-sm text-[#5f6368]">
            {mode === "signin"
              ? "Sign in to run audits and manage your Google Business Profile."
              : "Create an account to get started."}
          </p>
        </div>

        <div className="mb-6 flex rounded-full border border-[#dadce0] bg-[#f8f9fa] p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              mode === "signin" ? "bg-[#1a73e8] text-white" : "text-[#5f6368] hover:text-[#202124]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-[#1a73e8] text-white" : "text-[#5f6368] hover:text-[#202124]"
            }`}
          >
            Sign Up
          </button>
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
              className="w-full rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[#202124] placeholder:text-[#80868b] focus:border-[#1a73e8] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              placeholder="you@business.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#3c4043]">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-[#202124] placeholder:text-[#80868b] focus:border-[#1a73e8] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              placeholder="••••••••"
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
            disabled={loading}
            className="btn-primary w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#80868b]">
          <Link href="/" className="text-[#1a73e8] hover:underline">
            ← Back to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
