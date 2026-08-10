// The centrepiece: the artwork plate, the airing track, its acoustic-tag strip
// (genre · BPM · key · mood · energy — all optional, an untagged track just
// shows fewer labels), and the ticker rule.
//
// LONGWAVE signature moments live here: the plate (§5.1), the ticker rule
// (§5.2) and the ON AIR stamp (§5.3). The ticker rule is a printed rule, not a
// scrubber — it is non-interactive by construction, because this is live radio
// and there is nothing to seek to.

import { useStationFeed } from '@/hooks/useStationFeed';
import { useElapsed } from '@/hooks/useElapsed';
import { coverUrl } from '@/lib/stationClient';
import { clock } from '@/lib/format';
import type { NowPlayingTrack } from '@/lib/types';

/** Letterpress placeholder — the station monogram debossed into the stock.
 *  Used off-air and whenever a track carries no cover (jingles, idents). */
function Monogram({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`type-display select-none leading-none text-[var(--rule)] [text-shadow:0_1px_0_rgb(255_255_255/0.9)] ${className}`}
    >
      SW
    </span>
  );
}

function tagChips(t: NowPlayingTrack) {
  const chips: string[] = [];
  if (t.genre) chips.push(t.genre);
  if (typeof t.bpm === 'number') chips.push(`${Math.round(t.bpm)} BPM`);
  if (t.musicalKey) chips.push(t.musicalKey);
  if (t.energy) chips.push(`${t.energy} energy`);
  for (const m of t.moods ?? []) chips.push(m);
  return chips.slice(0, 6);
}

export function NowPlaying({ playing }: { playing: boolean }) {
  const { nowPlaying, ready } = useStationFeed();
  const track = nowPlaying?.nowPlaying ?? null;
  const key = track?.subsonic_id ?? track?.title;
  const elapsed = useElapsed(key, playing);

  const duration = track?.duration ?? 0;
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  if (ready && !track) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-[4px] border border-[var(--rule)] bg-[var(--leaf)] p-10 text-center sm:p-14">
        <span className="flex h-24 w-24 items-center justify-center rounded-[2px] bg-[var(--leaf-raised)]">
          <Monogram className="text-4xl tracking-[0.08em]" />
        </span>
        <div>
          <p className="type-display text-2xl leading-tight tracking-[-0.02em] text-[var(--graphite)]">
            Off air
          </p>
          <p className="mt-2 text-sm text-[var(--pencil)]">
            The station is off air right now.
          </p>
        </div>
      </div>
    );
  }

  const cover = track?.subsonic_id ? coverUrl(track.subsonic_id) : null;
  const chips = track ? tagChips(track) : [];
  const tickerLabel =
    duration > 0
      ? `Elapsed ${clock(elapsed)} of ${clock(duration)}`
      : `Elapsed ${clock(elapsed)}, live`;

  return (
    <article className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-12">
      {/* §5.1 The plate: an 8px mat, a hairline frame, one soft shadow, no glow. */}
      <div className="mx-auto w-full max-w-[22rem] lg:mx-0">
        <div className="relative rounded-[4px] border border-[var(--rule)] bg-[var(--leaf)] p-2 shadow-[var(--plate-shadow)]">
          <div className="relative aspect-square overflow-hidden rounded-[2px] bg-[var(--leaf-raised)]">
            {cover ? (
              <img
                src={cover}
                alt={track?.album || track?.title || 'cover'}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Monogram className="text-[5rem] tracking-[0.08em]" />
              </span>
            )}
          </div>

          {/* §5.3 The ON AIR stamp. */}
          {playing && (
            <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-[2px] border border-[var(--rule)] bg-[var(--paper)] px-2.5 py-1">
              <span
                aria-hidden="true"
                className="pulse-ring h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ember)]"
              />
              <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.2em] text-[var(--ember)]">
                On air
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Editorial track metadata. */}
      <div className="flex min-w-0 flex-col justify-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pencil)]">
          Now playing
        </p>

        {!ready ? (
          <div className="space-y-4" aria-label="Loading track information">
            <div className="h-10 w-5/6 animate-pulse rounded-[2px] bg-[var(--leaf-raised)]" />
            <div className="h-6 w-1/2 animate-pulse rounded-[2px] bg-[var(--leaf-raised)]" />
          </div>
        ) : (
          <>
            <h1 className="type-display break-words text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--graphite)]">
              {track?.title || 'Unknown track'}
            </h1>
            <p className="mt-3 break-words text-[1.125rem] font-medium text-[var(--ember)]">
              {track?.artist || 'Unknown artist'}
            </p>
            {(track?.album || track?.year) && (
              <p className="mt-2 break-words text-sm leading-[1.55] tabular-nums text-[var(--pencil)]">
                {track?.album}
                {track?.album && track?.year ? ' · ' : ''}
                {track?.year || ''}
              </p>
            )}

            {chips.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5" aria-label="Track signals">
                {chips.map((chip, index) => (
                  <span
                    key={`${chip}-${index}`}
                    className="max-w-full break-words text-[11px] font-medium uppercase tabular-nums tracking-[0.12em] text-[var(--pencil)] underline decoration-[var(--rule)] decoration-1 underline-offset-4"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {/* §5.2 The ticker rule. Elapsed time only — live radio has no seek
            control, so this carries no pointer handlers and no tab stop. */}
        <div className="mt-8 border-t border-[var(--rule)] pt-5">
          <div
            role="img"
            aria-label={tickerLabel}
            className="flex cursor-default items-center gap-3"
          >
            <span className="text-[11px] tabular-nums text-[var(--pencil)]">{clock(elapsed)}</span>
            <span aria-hidden="true" className="relative h-[2px] min-w-0 flex-1 bg-[var(--leaf-raised)]">
              <span
                className="absolute inset-y-0 left-0 bg-[var(--ember)] transition-[width] duration-1000 ease-linear"
                style={{ width: `${duration > 0 ? pct : 12}%` }}
              />
            </span>
            <span className="text-[11px] tabular-nums text-[var(--pencil)]">
              {duration > 0 ? clock(duration) : 'live'}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
