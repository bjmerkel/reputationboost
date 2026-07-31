export default function ImpersonationBanner({
  viewerLabel,
  adminEmail,
  canManageOnBehalf,
}: {
  viewerLabel: string;
  adminEmail: string | null;
  canManageOnBehalf: boolean;
}) {
  return (
    <div
      className={`shrink-0 border-b px-4 py-2 text-sm ${
        canManageOnBehalf
          ? "border-indigo-300 bg-indigo-50 text-indigo-950"
          : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-semibold">
            {canManageOnBehalf ? "Managing as user" : "Read-only view"}
          </span>{" "}
          — {canManageOnBehalf ? "updating account for" : "viewing as"}{" "}
          <span className="font-medium">{viewerLabel}</span>
          {adminEmail ? (
            <>
              {" "}
              (admin: <span className="font-medium">{adminEmail}</span>)
            </>
          ) : null}
          {canManageOnBehalf ? "." : ". Writes are disabled."}
        </p>
        <form action="/api/admin/impersonate/stop" method="post">
          <button
            type="submit"
            className={`rounded-full border bg-white px-3 py-1 text-sm font-medium hover:bg-slate-50 ${
              canManageOnBehalf
                ? "border-indigo-400 text-indigo-950"
                : "border-amber-400 text-amber-950"
            }`}
          >
            Exit {canManageOnBehalf ? "manage mode" : "view"}
          </button>
        </form>
      </div>
    </div>
  );
}
