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
    <div
      className={`rounded-2xl border p-5 ${
        mismatchIsOk
          ? "border-slate-500/25 bg-slate-500/5"
          : accountMismatch
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Account separation
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        Reputation Boost sign-in and Google Business Profile authorization are two different
        logins. GBP data always comes from the Google account below — not your app sign-in.
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-slate-500">Signed in to Reputation Boost</dt>
          <dd className="mt-0.5 font-medium text-slate-200">
            {platformEmail ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Google Business Profile authorized via</dt>
          <dd className="mt-0.5 font-medium text-slate-200">
            {googleAccountEmail ?? "Resolving…"}
            {gbpAccessVerified && googleAccountEmail && (
              <span className="ml-2 text-emerald-400">· Manager access verified</span>
            )}
          </dd>
        </div>
      </dl>

      {mismatchIsOk && platformEmail && googleAccountEmail && (
        <p className="mt-4 text-sm text-slate-300">
          These accounts differ by design. {googleAccountEmail} is your GBP Manager — keep this
          connection. You can stay signed in to the app as {platformEmail}.
        </p>
      )}

      {accountMismatch && !gbpAccessVerified && platformEmail && googleAccountEmail && (
        <p className="mt-4 text-sm text-amber-200/90">
          These accounts differ. Reconnect GBP with the Google account that is Owner or Manager on
          this business — that may be {googleAccountEmail}, not {platformEmail}.
        </p>
      )}
    </div>
  );
}
