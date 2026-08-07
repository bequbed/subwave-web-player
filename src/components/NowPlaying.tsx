// The centrepiece: big cover art, the airing track, its acoustic-tag strip
// (genre · BPM · key · mood · energy — all optional, an untagged track just
// shows fewer chips), and a client-side progress bar.

import { useStationFeed } from '@/hooks/useStationFeed';
import { useElapsed } from '@/hooks/useElapsed';
import { coverUrl } from '@/lib/stationClient';
import { clock, gradientFor } from '@/lib/format';
import type { NowPlayingTrack } from '@/lib/types';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
      {children}
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-10 text-center">
        <div className="text-4xl">📻</div>
        <p className="text-sm text-[var(--muted)]">The station is off air right now.</p>
      </div>
    );
  }

  const cover = track?.subsonic_id ? coverUrl(track.subsonic_id) : null;
  const chips = track ? tagChips(track) : [];

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        {/* Cover */}
        <div className="relative mx-auto aspect-square w-full max-w-[280px] shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--line)] sm:mx-0 sm:w-56">
          {cover ? (
            <img
              src={cover}
              alt={track?.album || track?.title || 'cover'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full" style={{ background: gradientFor(key) }} />
          )}
          {playing && (
            <div className="absolute bottom-2 left-2 flex items-end gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-[var(--accent)]"
                  style={{
                    height: 16,
                    transformOrigin: 'bottom',
                    animation: `bar ${0.7 + i * 0.15}s ease-in-out ${i * 0.1}s infinite`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {!ready ? (
            <div className="space-y-3">
              <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--panel-2)]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--panel-2)]" />
            </div>
          ) : (
            <>
              <h1 className="truncate text-2xl font-bold sm:text-3xl">
                {track?.title || 'Unknown track'}
              </h1>
              <p className="mt-1 truncate text-lg text-[var(--accent)]">
                {track?.artist || 'Unknown artist'}
              </p>
              {(track?.album || track?.year) && (
                <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                  {track?.album}
                  {track?.album && track?.year ? ' · ' : ''}
                  {track?.year || ''}
                </p>
              )}

              {chips.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <Chip key={c}>{c}</Chip>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Progress */}
          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-2)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-[width] duration-1000 ease-linear"
                style={{ width: `${duration > 0 ? pct : 12}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-[var(--muted)]">
              <span>{clock(elapsed)}</span>
              <span>{duration > 0 ? clock(duration) : 'live'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
