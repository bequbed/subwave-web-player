// Coming up + recently played, from /state. SUB/WAVE is live radio, so
// "upcoming" is a short tease (usually one track — Liquidsoap controls pacing)
// and there's no reordering; this is a read-only window into the flow.
//
// Up-next rows carry a small cover tile (the /cover/:id proxy) with the queue
// ordinal overprinted on it; a missing id or a broken load falls back to a
// monogram-style tile so the column never shows a hole. Recently played stays
// a quiet borderless list — density beats thumbnails for a dozen rows.

import { useState } from 'react';
import { useStationFeed } from '@/hooks/useStationFeed';
import { Panel } from '@/components/ui/Panel';
import { timeAgo } from '@/lib/format';
import { coverUrl } from '@/lib/stationClient';
import type { QueueEntry } from '@/lib/types';

/** 40px cover tile with the ordinal overprinted on a dark foot. The three
    states a tile can be in: real art, art that failed, no id at all. */
function CoverTile({ subsonicId, ordinal }: { subsonicId?: string; ordinal?: number }) {
  const [broken, setBroken] = useState(false);
  const label = ordinal != null ? String(ordinal).padStart(2, '0') : null;

  if (subsonicId && !broken) {
    return (
      <span className="relative block h-10 w-10 shrink-0" aria-hidden="true">
        <img
          src={coverUrl(subsonicId)}
          alt=""
          loading="lazy"
          width={40}
          height={40}
          onError={() => setBroken(true)}
          className="h-full w-full rounded-[2px] border border-[var(--rule)] bg-[var(--leaf-raised)] object-cover"
        />
        {label && (
          <span className="absolute inset-x-0 bottom-0 rounded-b-[2px] bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-2.5 text-center text-[9px] font-semibold leading-none tabular-nums text-white">
            {label}
          </span>
        )}
      </span>
    );
  }
  // No id (jingle tease) or broken image: the old ordinal chip, enlarged.
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] border border-[var(--rule)] bg-[var(--leaf-raised)] text-[10px] font-semibold tabular-nums text-[var(--ember)]"
    >
      {label ?? '·'}
    </span>
  );
}

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
        {!muted && <CoverTile subsonicId={entry.subsonic_id} ordinal={ordinal} />}
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
