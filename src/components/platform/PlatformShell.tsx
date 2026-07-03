"use client";

interface PlatformShellProps {
  searchBar: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export default function PlatformShell({ searchBar, toolbar, children }: PlatformShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[#dadce0] bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {searchBar}
          {toolbar}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-hidden lg:flex-row">
        {children}
      </div>
    </div>
  );
}
