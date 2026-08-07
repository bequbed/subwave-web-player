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
      className={`flex min-h-0 flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)] ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          {title}
        </h2>
        {aside}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
