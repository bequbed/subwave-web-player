// Coming up + recently played, from /state. SUB/WAVE is live radio, so
// "upcoming" is a short tease (usually one track — Liquidsoap controls pacing)
// and there's no reordering; this is a read-only window into the flow.

import { useStationFeed } from '@/hooks/useStationFeed';
import { Panel } from '@/components/ui/Panel';
import { timeAgo } from '@/lib/format';
import type { QueueEntry } from '@/lib/types';

function Row({ entry, muted, ordinal }: { entry: QueueEntry; muted?: boolean; ordinal?: number }) {
  return (
    <li
      className={`flex items-center justify-between gap-3 ${
        muted ? 'border-b border-[var(--line)] py-2.5 opacity-70' : 'rounded-xl border border-[var(--line)] bg-white/[0.025] p-3'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {ordinal != null && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--signal)]/25 bg-[var(--signal)]/10 text-[10px] font-bold text-[var(--signal)]">
            {String(ordinal).padStart(2, '0')}
          </span>
        )}
        <div className="min-w-0">
          <p
            className={`truncate text-sm ${muted ? 'font-normal text-[var(--muted)]' : 'font-semibold text-[var(--fg)]'}`}
          >
            {entry.title || 'Unknown'}
          </p>
          <p className={`truncate text-xs ${muted ? 'text-[var(--muted)]/75' : 'text-[var(--muted)]'}`}>
            {entry.artist || ''}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {entry.requestedBy && (
          <span className="rounded-full border border-[var(--signal)]/15 bg-[var(--signal)]/8 px-2 py-0.5 text-[10px] text-[var(--signal)]">
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
      <div className="scroll-thin h-full overflow-y-auto px-4 py-2 sm:px-5">
        {!ready ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <p className="pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">
                  Up next
                </p>
                <ul className="space-y-2">
                  {upcoming.map((e, i) => (
                    <Row key={`up-${i}`} entry={e} ordinal={i + 1} />
                  ))}
                </ul>
              </>
            )}
            <p className="pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Recently played
            </p>
            {history.length === 0 ? (
              <p className="py-4 text-sm text-[var(--muted)]">Nothing logged yet.</p>
            ) : (
              <ul>
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
