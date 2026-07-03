"use client";

export default function GbpAccountSummary({
  platformEmail,
  googleAccountEmail,
  accountMismatch,
  gbpAccessVerified,
}: {
  platformEmail?: string;
  googleAccountEmail?: string;
  accountMismatch?: boolean;
  gbpAccessVerified?: boolean;
}) {
  if (!platformEmail && !googleAccountEmail) return null;

  const mismatchIsOk = accountMismatch && gbpAccessVerified;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white">Your accounts</h3>
      <p className="mt-1 text-sm text-slate-500">
        Your app login and your Google Business Profile login can be different — that&apos;s
        normal.
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-slate-500">App login</dt>
          <dd className="mt-0.5 font-medium text-slate-200">
            {platformEmail ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Manages Google Business Profile</dt>
          <dd className="mt-0.5 font-medium text-slate-200">
            {googleAccountEmail ?? "Loading…"}
          </dd>
        </div>
      </dl>

      {mismatchIsOk && platformEmail && googleAccountEmail && (
        <p className="mt-4 text-sm text-slate-400">
          {googleAccountEmail} manages the profile. You can keep using the app as{" "}
          {platformEmail}.
        </p>
      )}
    </div>
  );
}
