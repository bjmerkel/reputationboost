export default function ViewAsUserButton({
  userId,
  businessId,
  label = "View as user",
}: {
  userId: string;
  businessId?: string;
  label?: string;
}) {
  return (
    <form action="/api/admin/impersonate" method="post">
      <input type="hidden" name="userId" value={userId} />
      {businessId ? <input type="hidden" name="businessId" value={businessId} /> : null}
      <button
        type="submit"
        className="rounded-lg border border-[#6366f1] bg-[#6366f1]/10 px-4 py-2 text-sm font-medium text-[#a5b4fc] transition-colors hover:bg-[#6366f1]/20"
      >
        {label}
      </button>
    </form>
  );
}
