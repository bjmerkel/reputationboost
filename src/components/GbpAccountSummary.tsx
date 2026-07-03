"use client";

export default function GbpAccountSummary({
  platformEmail,
  googleAccountEmail,
  accountMismatch,
}: {
  platformEmail?: string;
  googleAccountEmail?: string;
  accountMismatch?: boolean;
}) {
  if (!platformEmail && !googleAccountEmail) return null;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        accountMismatch
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Account separation
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        Reputation Boost sign-in and Google Business Profile authorization are two different
        logins. GBP data always comes from the Google account below.
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
          </dd>
        </div>
      </dl>

      {accountMismatch && platformEmail && googleAccountEmail && (
        <p className="mt-4 text-sm text-amber-200/90">
          These accounts differ. If metrics or edits fail, reconnect GBP with the Google account
          that is Owner or Manager on this business
          {platformEmail !== googleAccountEmail ? ` (e.g. ${platformEmail})` : ""}.
        </p>
      )}
    </div>
  );
}
