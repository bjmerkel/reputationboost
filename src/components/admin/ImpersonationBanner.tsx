export default function ImpersonationBanner({
  viewerLabel,
  adminEmail,
}: {
  viewerLabel: string;
  adminEmail: string | null;
}) {
  return (
    <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-semibold">Read-only view</span> — viewing as{" "}
          <span className="font-medium">{viewerLabel}</span>
          {adminEmail ? (
            <>
              {" "}
              (admin: <span className="font-medium">{adminEmail}</span>)
            </>
          ) : null}
          . Writes are disabled.
        </p>
        <form action="/api/admin/impersonate/stop" method="post">
          <button
            type="submit"
            className="rounded-full border border-amber-400 bg-white px-3 py-1 text-sm font-medium text-amber-950 hover:bg-amber-100"
          >
            Exit view
          </button>
        </form>
      </div>
    </div>
  );
}
