// A titled surface used by the secondary columns (booth, queue, schedule,
// request). Keeps the section chrome in one place so a redesign restyles every
// panel at once.

import type { ReactNode } from 'react';

export function Panel({
  title,
  aside,
  children,
  className = '',
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-[var(--panel)] shadow-[0_18px_60px_rgb(0_0_0/0.18)] backdrop-blur-xl transition-[border-color,box-shadow] focus-within:border-[var(--signal)] focus-within:shadow-[0_18px_60px_rgb(0_0_0/0.24)] ${className}`}
    >
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--signal)]" />
          <h2 className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {title}
          </h2>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
