"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import type { AuditView } from "@/components/audit/types";
import {
  buildProductPlaybook,
  type PlaybookActionKind,
  type PlaybookItem,
  type ProductPlaybook,
} from "@/lib/platform/product-playbook";

const STORAGE_KEY = "rb-playbook-dismissed-tips";
const OPENED_KEY = "rb-playbook-opened";

function loadDismissedTips(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDismissedTips(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage failures
  }
}

const STAGE_ORDER = ["setup", "launch", "execute", "grow", "maintain"] as const;

const STAGE_COLORS: Record<string, string> = {
  setup: "#1a73e8",
  launch: "#9334e6",
  execute: "#e37400",
  grow: "#188038",
  maintain: "#5f6368",
};

interface ProductPlaybookWizardProps {
  gbpConnected: boolean;
  businessId?: string;
  audit: FullAuditPayload | null;
  tasks: ExecutionTask[];
  avgCustomerValue?: number | null;
  onRunAudit: () => void;
  onOpenReview: () => void;
  onSetView: (view: AuditView) => void;
  auditLoading?: boolean;
}

export default function ProductPlaybookWizard({
  gbpConnected,
  businessId,
  audit,
  tasks,
  avgCustomerValue,
  onRunAudit,
  onOpenReview,
  onSetView,
  auditLoading = false,
}: ProductPlaybookWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissedTips(loadDismissedTips());
    setHydrated(true);
  }, []);

  const playbook = useMemo(
    () =>
      buildProductPlaybook({
        gbpConnected,
        businessId,
        audit,
        tasks,
        avgCustomerValue,
        dismissedTips,
      }),
    [gbpConnected, businessId, audit, tasks, avgCustomerValue, dismissedTips]
  );

  useEffect(() => {
    if (!hydrated) return;
    const onboarded = searchParams.get("onboarded") === "1";
    const skippedGbp = searchParams.get("skipped_gbp") === "1";
    const openedBefore = localStorage.getItem(OPENED_KEY) === "1";

    if (onboarded || skippedGbp || (!openedBefore && playbook.pendingCount > 0)) {
      setOpen(true);
      localStorage.setItem(OPENED_KEY, "1");
    }
  }, [hydrated, searchParams, playbook.pendingCount]);

  const dismissTip = useCallback((id: string) => {
    setDismissedTips((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      saveDismissedTips(next);
      return next;
    });
  }, []);

  const handleAction = useCallback(
    (item: PlaybookItem) => {
      const educational = ["read-report", "explore-map", "map-weak-zones", "monthly-report", "track-results"];

      if (educational.includes(item.id)) {
        dismissTip(item.id);
      }

      switch (item.action) {
        case "connect_gbp":
          if (item.href) router.push(item.href);
          break;
        case "run_audit":
        case "refresh_audit":
          onRunAudit();
          break;
        case "review_approvals":
          onOpenReview();
          break;
        case "open_plan":
          onSetView("strategy");
          break;
        case "open_report":
          onSetView("report");
          break;
        case "open_results":
          onSetView("data");
          break;
        case "open_map":
          setOpen(false);
          break;
        case "open_settings_roi":
        case "open_settings_permissions":
          if (item.href) router.push(item.href);
          break;
        default:
          break;
      }

      if (item.action !== "open_map") {
        setOpen(false);
      }
    },
    [dismissTip, onOpenReview, onRunAudit, onSetView, router]
  );

  if (!hydrated) return null;

  return (
    <>
      <PlaybookLauncher
        playbook={playbook}
        onClick={() => setOpen(true)}
      />

      {open && (
        <PlaybookPanel
          playbook={playbook}
          auditLoading={auditLoading}
          onClose={() => setOpen(false)}
          onAction={handleAction}
          onDismissTip={dismissTip}
        />
      )}
    </>
  );
}

function PlaybookLauncher({
  playbook,
  onClick,
}: {
  playbook: ProductPlaybook;
  onClick: () => void;
}) {
  const stageColor = STAGE_COLORS[playbook.stage] ?? "#1a73e8";

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 left-4 z-30 flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 py-2.5 shadow-[0_4px_16px_rgba(60,64,67,0.18)] transition hover:shadow-[0_6px_20px_rgba(60,64,67,0.22)] sm:bottom-6 lg:left-[calc(408px+1.25rem)]"
      aria-label="Open your playbook"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: stageColor }}
      >
        {playbook.pendingCount > 0 ? playbook.pendingCount : "✓"}
      </span>
      <span className="hidden text-sm font-semibold text-[#202124] sm:inline">Your playbook</span>
    </button>
  );
}

function PlaybookPanel({
  playbook,
  auditLoading,
  onClose,
  onAction,
  onDismissTip,
}: {
  playbook: ProductPlaybook;
  auditLoading: boolean;
  onClose: () => void;
  onAction: (item: PlaybookItem) => void;
  onDismissTip: (id: string) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const pending = playbook.items.filter((i) => i.status === "pending");
  const done = playbook.items.filter((i) => i.status === "done");
  const stageColor = STAGE_COLORS[playbook.stage] ?? "#1a73e8";
  const stageIndex = STAGE_ORDER.indexOf(playbook.stage);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose} role="presentation">
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-[-8px_0_32px_rgba(60,64,67,0.15)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playbook-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="shrink-0 px-5 pb-5 pt-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${stageColor} 0%, #174ea6 100%)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                Your playbook
              </p>
              <h2 id="playbook-title" className="mt-1 text-xl font-bold">
                {playbook.stageLabel}
              </h2>
              <p className="mt-1 text-sm text-white/90">{playbook.stageDescription}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-white/90 hover:bg-white/10"
              aria-label="Close playbook"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <ProgressRing percent={playbook.progressPercent} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {playbook.completedCount} of {playbook.items.length} steps done
              </p>
              <div className="mt-2 flex gap-1">
                {STAGE_ORDER.map((stage, i) => (
                  <span
                    key={stage}
                    className={`h-1 flex-1 rounded-full ${
                      i <= stageIndex ? "bg-white" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/80">
                Stage {stageIndex + 1} of {STAGE_ORDER.length}
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {playbook.nextItem && (
            <section className="mb-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
                Do this next
              </p>
              <PlaybookCard
                item={playbook.nextItem}
                featured
                loading={auditLoading}
                onAction={() => onAction(playbook.nextItem!)}
                onDismiss={() => onDismissTip(playbook.nextItem!.id)}
              />
            </section>
          )}

          {pending.length > 1 && (
            <section className="mb-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
                Coming up
              </p>
              <div className="space-y-2">
                {pending.slice(1).map((item) => (
                  <PlaybookCard
                    key={item.id}
                    item={item}
                    loading={auditLoading}
                    onAction={() => onAction(item)}
                    onDismiss={() => onDismissTip(item.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
                Completed
              </p>
              <div className="space-y-2">
                {done.map((item) => (
                  <PlaybookCard key={item.id} item={item} done />
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
        {percent}%
      </span>
    </div>
  );
}

function actionLabel(action: PlaybookActionKind, loading: boolean): string {
  if (loading && (action === "run_audit" || action === "refresh_audit")) {
    return "Running…";
  }
  switch (action) {
    case "connect_gbp":
      return "Connect →";
    case "run_audit":
      return "Run audit →";
    case "refresh_audit":
      return "Refresh →";
    case "review_approvals":
      return "Review now →";
    case "open_plan":
      return "Open plan →";
    case "open_report":
      return "View report →";
    case "open_results":
      return "View results →";
    case "open_map":
      return "Explore map →";
    case "open_settings_roi":
    case "open_settings_permissions":
      return "Open settings →";
    default:
      return "Go →";
  }
}

function PlaybookCard({
  item,
  featured = false,
  done = false,
  loading = false,
  onAction,
  onDismiss,
}: {
  item: PlaybookItem;
  featured?: boolean;
  done?: boolean;
  loading?: boolean;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const educational = ["read-report", "explore-map", "map-weak-zones", "monthly-report", "track-results"];

  return (
    <article
      className={`rounded-xl border p-4 ${
        done
          ? "border-[#ceead6] bg-[#f6faf7]"
          : featured
            ? "border-[#1a73e8] bg-[#e8f0fe] shadow-sm"
            : "border-[#e8eaed] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`text-sm font-semibold ${done ? "text-[#137333]" : "text-[#202124]"}`}
        >
          {done && <span className="mr-1">✓</span>}
          {item.title}
        </h3>
        {item.estimatedMinutes && !done && (
          <span className="shrink-0 rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[10px] font-medium text-[#5f6368]">
            ~{item.estimatedMinutes} min
          </span>
        )}
      </div>
      <p className={`mt-1 text-xs leading-relaxed ${done ? "text-[#5f6368]" : "text-[#3c4043]"}`}>
        {item.description}
      </p>
      {!done && (
        <p className="mt-2 text-[10px] text-[#80868b]">
          <span className="font-medium text-[#5f6368]">Why: </span>
          {item.why}
        </p>
      )}
      {!done && onAction && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onAction}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
              featured ? "btn-primary" : "bg-[#1a73e8] hover:bg-[#1557b0]"
            }`}
          >
            {actionLabel(item.action, loading)}
          </button>
          {educational.includes(item.id) && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              Mark done
            </button>
          )}
        </div>
      )}
    </article>
  );
}
