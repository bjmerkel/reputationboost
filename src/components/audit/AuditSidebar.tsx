"use client";

import { AUDIT_STORY_STEPS, type AuditView } from "./types";

interface AuditSidebarProps {
  active: AuditView;
  onChange: (view: AuditView) => void;
  pendingTasks?: number;
  pendingPhotoTasks?: number;
}

const VIEW_ICONS: Record<AuditView, React.ReactNode> = {
  report: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  reviews: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  strategy: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
  photos: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
  execute: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  data: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
};

export default function AuditSidebar({
  active,
  onChange,
  pendingTasks = 0,
  pendingPhotoTasks = 0,
}: AuditSidebarProps) {
  return (
    <aside className="flex w-full flex-col border-b border-white/8 bg-slate-950/60 lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="hidden px-4 pt-5 pb-2 lg:block">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Workspace</p>
      </div>

      <nav aria-label="Audit sections" className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:px-2 lg:pb-4">
        {AUDIT_STORY_STEPS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`group relative flex min-w-[9rem] shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition lg:min-w-0 lg:w-full ${
                isActive
                  ? "bg-white/10 text-white before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-0.5 before:rounded-full before:bg-emerald-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span
                className={`shrink-0 ${
                  isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                }`}
              >
                {VIEW_ICONS[item.id]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  {item.id === "execute" && pendingTasks > 0 && (
                    <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      {pendingTasks}
                    </span>
                  )}
                  {item.id === "photos" && pendingPhotoTasks > 0 && (
                    <span className="rounded-full bg-violet-500/25 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                      {pendingPhotoTasks}
                    </span>
                  )}
                </span>
                <span className="hidden truncate text-xs text-slate-500 lg:block">
                  {item.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function AuditViewHeader({ view }: { view: AuditView }) {
  const step = AUDIT_STORY_STEPS.find((s) => s.id === view);
  if (!step) return null;

  return (
    <div className="mb-6 border-b border-white/8 pb-5">
      <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
        Step {step.step}
      </p>
      <h2 className="mt-1 text-2xl font-bold text-white">{step.title}</h2>
      <p className="mt-1 text-sm text-slate-400">{step.subtitle}</p>
    </div>
  );
}
