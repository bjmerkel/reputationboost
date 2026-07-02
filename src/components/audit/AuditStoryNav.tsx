"use client";

import { AUDIT_STORY_STEPS, type AuditView } from "./types";

interface AuditStoryNavProps {
  active: AuditView;
  onChange: (view: AuditView) => void;
  pendingTasks?: number;
}

export default function AuditStoryNav({
  active,
  onChange,
  pendingTasks = 0,
}: AuditStoryNavProps) {
  return (
    <nav aria-label="Audit workflow" className="space-y-4">
      <div className="hidden md:grid md:grid-cols-4 md:gap-3">
        {AUDIT_STORY_STEPS.map((item, index) => {
          const isActive = active === item.id;
          const isPast = AUDIT_STORY_STEPS.findIndex((s) => s.id === active) > index;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`relative rounded-xl border p-4 text-left transition ${
                isActive
                  ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/20"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    isActive
                      ? "bg-emerald-500 text-slate-900"
                      : isPast
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-slate-400"
                  }`}
                >
                  {item.step}
                </span>
                {item.id === "execute" && pendingTasks > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    {pendingTasks} pending
                  </span>
                )}
              </div>
              <p className={`mt-3 font-semibold ${isActive ? "text-white" : "text-slate-200"}`}>
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        {AUDIT_STORY_STEPS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-emerald-500 text-slate-900"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {item.step}. {item.title}
              {item.id === "execute" && pendingTasks > 0 && ` (${pendingTasks})`}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

interface AuditViewFooterProps {
  active: AuditView;
  onChange: (view: AuditView) => void;
}

export function AuditViewFooter({ active, onChange }: AuditViewFooterProps) {
  const index = AUDIT_STORY_STEPS.findIndex((s) => s.id === active);
  const prev = index > 0 ? AUDIT_STORY_STEPS[index - 1] : null;
  const next = index < AUDIT_STORY_STEPS.length - 1 ? AUDIT_STORY_STEPS[index + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-6">
      {prev ? (
        <button
          type="button"
          onClick={() => onChange(prev.id)}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          ← {prev.title}
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button
          type="button"
          onClick={() => onChange(next.id)}
          className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Next: {next.title} →
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
