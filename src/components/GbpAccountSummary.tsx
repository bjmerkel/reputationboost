"use client";

export default function GbpAccountSummary({
  platformEmail,
  googleAccountEmail,
  accountMismatch,
  gbpAccessVerified,
  variant = "dark",
}: {
  platformEmail?: string;
  googleAccountEmail?: string;
  accountMismatch?: boolean;
  gbpAccessVerified?: boolean;
  variant?: "dark" | "light";
}) {
  if (!platformEmail && !googleAccountEmail) return null;

  const isLight = variant === "light";
  const mismatchIsOk = accountMismatch && gbpAccessVerified;

  return (
    <div
      className={`rounded-xl border p-5 ${
        isLight ? "border-[#dadce0] bg-white shadow-sm" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <h3 className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
        Your accounts
      </h3>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-500"}`}>
        Your app login and your Google Business Profile login can be different — that&apos;s
        normal.
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className={isLight ? "text-[#80868b]" : "text-slate-500"}>App login</dt>
          <dd className={`mt-0.5 font-medium ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>
            {platformEmail ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt className={isLight ? "text-[#80868b]" : "text-slate-500"}>
            Manages Google Business Profile
          </dt>
          <dd className={`mt-0.5 font-medium ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>
            {googleAccountEmail ?? "Loading…"}
          </dd>
        </div>
      </dl>

      {mismatchIsOk && platformEmail && googleAccountEmail && (
        <p className={`mt-4 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          {googleAccountEmail} manages the profile. You can keep using the app as{" "}
          {platformEmail}.
        </p>
      )}
    </div>
  );
}
