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
        muted
          ? 'border-b border-[var(--rule)] py-2.5'
          : 'rounded-[4px] border border-[var(--rule)] bg-[var(--leaf-raised)] p-3'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {ordinal != null && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-[var(--rule)] bg-[var(--leaf)] text-[11px] font-semibold tabular-nums text-[var(--ember)]">
            {String(ordinal).padStart(2, '0')}
          </span>
        )}
        <div className="min-w-0">
          <p
            className={`truncate text-sm ${muted ? 'font-normal text-[var(--pencil)]' : 'font-semibold text-[var(--graphite)]'}`}
          >
            {entry.title || 'Unknown'}
          </p>
          <p className="truncate text-[11px] text-[var(--pencil)]">{entry.artist || ''}</p>
        </div>
      </div>
      <div className="min-w-0 max-w-[42%] shrink text-right sm:max-w-[50%]">
        {entry.requestedBy && (
          <span
            className="block max-w-full truncate rounded-[2px] border border-[var(--rule)] bg-[var(--leaf)] px-2 py-0.5 text-[11px] text-[var(--ember)]"
            title={entry.requestedBy}
            aria-label={`Requested by ${entry.requestedBy}`}
          >
            req. {entry.requestedBy}
          </span>
        )}
        {entry.t && (
          <p className="mt-0.5 text-[11px] tabular-nums text-[var(--pencil)]">{timeAgo(entry.t)}</p>
        )}
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
          <p className="py-8 text-center text-sm text-[var(--pencil)]">Loading…</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <p className="pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember)]">
                  Up next
                </p>
                <ul className="space-y-2">
                  {upcoming.map((e, i) => (
                    <Row key={`up-${i}`} entry={e} ordinal={i + 1} />
                  ))}
                </ul>
              </>
            )}
            <p className="pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pencil)]">
              Recently played
            </p>
            {history.length === 0 ? (
              <p className="py-4 text-sm text-[var(--pencil)]">Nothing logged yet.</p>
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
