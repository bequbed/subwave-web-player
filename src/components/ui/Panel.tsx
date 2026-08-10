// A titled surface used by the secondary columns (booth, queue, schedule,
// request). Keeps the section chrome in one place so a redesign restyles every
// panel at once. LONGWAVE: a sheet on a desk — hairline rule, 4px corners, no
// shadow, heading set in small caps.

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
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--leaf)] transition-colors focus-within:border-[var(--ember)] ${className}`}
    >
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-2.5 sm:px-5">
        {/* The title never truncates; a long aside (e.g. the schedule's
            timezone) gives way first. */}
        <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pencil)]">
          {title}
        </h2>
        {aside && <div className="flex min-w-0 justify-end">{aside}</div>}
      </header>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </section>
  );
}
