import type { ExecutionTask } from "@/audit/types";

function readKeywordPayload(task: ExecutionTask) {
  const suggestedKeyword =
    typeof task.payload.suggestedKeyword === "string" ? task.payload.suggestedKeyword : null;
  const activeCampaignKeyword =
    typeof task.payload.activeCampaignKeyword === "string"
      ? task.payload.activeCampaignKeyword
      : null;
  const keywordsHit = Array.isArray(task.payload.keywordsHit)
    ? task.payload.keywordsHit.filter((value): value is string => typeof value === "string")
    : [];
  const weaveSkipped = task.payload.weaveSkipped === true;
  const weaveReason =
    typeof task.payload.weaveReason === "string" ? task.payload.weaveReason : null;
  const expectedEffect =
    typeof task.payload.expectedEffect === "string" ? task.payload.expectedEffect : null;

  return {
    suggestedKeyword,
    activeCampaignKeyword,
    keywordsHit,
    weaveSkipped,
    weaveReason,
    expectedEffect,
  };
}

export default function ReviewResponseKeywordHints({
  task,
  variant = "light",
  onSuggestWeave,
  loading = false,
}: {
  task: ExecutionTask;
  variant?: "light" | "dark";
  onSuggestWeave?: () => void;
  loading?: boolean;
}) {
  if (task.type !== "review_response") return null;

  const {
    suggestedKeyword,
    activeCampaignKeyword,
    keywordsHit,
    weaveSkipped,
    weaveReason,
    expectedEffect,
  } = readKeywordPayload(task);

  const muted = variant === "light" ? "text-[#80868b]" : "text-slate-500";
  const body = variant === "light" ? "text-[#3c4043]" : "text-slate-300";
  const accent = variant === "light" ? "text-[#1a73e8]" : "text-sky-400";
  const success = variant === "light" ? "text-[#188038]" : "text-emerald-400";
  const hint = variant === "light" ? "text-[#5f6368]" : "text-slate-400";

  return (
    <div className="space-y-2">
      {activeCampaignKeyword && (
        <p className={`text-sm ${accent}`}>
          Active campaign: collecting &ldquo;{activeCampaignKeyword}&rdquo; reviews
        </p>
      )}
      {keywordsHit.length > 0 && (
        <p className={`text-sm ${success}`}>
          Mentions {keywordsHit.map((keyword) => `"${keyword}"`).join(", ")}
        </p>
      )}
      {suggestedKeyword && keywordsHit.length === 0 && weaveSkipped && (
        <p className={`text-sm ${muted}`}>No keyword added — reply stays natural.</p>
      )}
      {suggestedKeyword && keywordsHit.length === 0 && !weaveSkipped && (
        <p className={`text-sm ${hint}`}>
          Could mention: &ldquo;{suggestedKeyword}&rdquo;
          {onSuggestWeave && (
            <button
              type="button"
              disabled={loading}
              onClick={onSuggestWeave}
              className={`ml-2 hover:underline disabled:opacity-50 ${accent}`}
            >
              Try weave
            </button>
          )}
        </p>
      )}
      {weaveReason && (
        <p className={`text-sm ${body}`}>
          <span className="font-medium">Why: </span>
          {weaveReason}
        </p>
      )}
      {expectedEffect && !weaveReason && (
        <p className={`text-sm ${body}`}>
          <span className="font-medium">Why: </span>
          {expectedEffect}
        </p>
      )}
    </div>
  );
}

export function reviewResponseCanSuggestWeave(task: ExecutionTask): boolean {
  if (task.type !== "review_response") return false;
  const { suggestedKeyword, keywordsHit } = readKeywordPayload(task);
  return Boolean(suggestedKeyword && keywordsHit.length === 0);
}
