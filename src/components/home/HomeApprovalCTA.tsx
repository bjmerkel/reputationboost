"use client";

export default function HomeApprovalCTA({
  pendingCount,
  onReview,
}: {
  pendingCount: number;
  onReview: () => void;
}) {
  if (pendingCount <= 0) return null;

  return (
    <section className="rounded-xl border border-[#fdd663] bg-[#fef7e0] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#e37400]">
        What needs me right now?
      </p>
      <p className="mt-2 text-lg font-semibold text-[#202124]">
        {pendingCount} item{pendingCount === 1 ? "" : "s"} need your approval
      </p>
      <p className="mt-1 text-sm text-[#5f6368]">
        Step through profile edits, posts, and review replies in one two-minute session.
      </p>
      <button
        type="button"
        onClick={onReview}
        className="btn-primary mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
      >
        Review now →
      </button>
    </section>
  );
}
