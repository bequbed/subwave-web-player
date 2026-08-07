// Coming up + recently played, from /state. SUB/WAVE is live radio, so
// "upcoming" is a short tease (usually one track — Liquidsoap controls pacing)
// and there's no reordering; this is a read-only window into the flow.

import { useStationFeed } from '@/hooks/useStationFeed';
import { Panel } from '@/components/ui/Panel';
import { timeAgo } from '@/lib/format';
import type { QueueEntry } from '@/lib/types';

function Row({ entry, muted }: { entry: QueueEntry; muted?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className={`truncate text-sm ${muted ? 'text-[var(--muted)]' : 'text-[var(--fg)]'}`}>
          {entry.title || 'Unknown'}
        </p>
        <p className="truncate text-xs text-[var(--muted)]">{entry.artist || ''}</p>
      </div>
      <div className="shrink-0 text-right">
        {entry.requestedBy && (
          <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
            ♥ {entry.requestedBy}
          </span>
        )}
        {entry.t && <p className="mt-0.5 text-[10px] text-[var(--muted)]">{timeAgo(entry.t)}</p>}
      </div>
    </li>
  );
}

export function Queue() {
  const { state, ready } = useStationFeed();
  const upcoming = (state?.upcoming ?? []).slice(0, 4);
  const history = (state?.history ?? []).slice(0, 12);

  return (
    <Panel title="On the Deck" className="h-full">
      <div className="scroll-thin h-full overflow-y-auto px-4 py-1">
        {!ready ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <p className="pt-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                  Up next
                </p>
                <ul className="divide-y divide-[var(--line)]">
                  {upcoming.map((e, i) => (
                    <Row key={`up-${i}`} entry={e} />
                  ))}
                </ul>
              </>
            )}
            <p className="pt-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              Recently played
            </p>
            {history.length === 0 ? (
              <p className="py-4 text-sm text-[var(--muted)]">Nothing logged yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {history.map((e, i) => (
                  <Row key={`h-${i}`} entry={e} muted />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
