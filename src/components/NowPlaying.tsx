// The centrepiece: big cover art, the airing track, its acoustic-tag strip
// (genre · BPM · key · mood · energy — all optional, an untagged track just
// shows fewer labels), and a client-side progress bar.

import { useStationFeed } from '@/hooks/useStationFeed';
import { useElapsed } from '@/hooks/useElapsed';
import { coverUrl } from '@/lib/stationClient';
import { clock, gradientFor } from '@/lib/format';
import type { NowPlayingTrack } from '@/lib/types';

function SignalLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
      <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-[var(--signal)]/60" />
      <span className="break-words">{children}</span>
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-10 text-center shadow-2xl shadow-black/20">
        <div className="text-4xl">📻</div>
        <p className="text-sm text-[var(--muted)]">The station is off air right now.</p>
      </div>
    );
  }

  const cover = track?.subsonic_id ? coverUrl(track.subsonic_id) : null;
  const chips = track ? tagChips(track) : [];
  const artworkGradient = gradientFor(key);

  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl shadow-black/25 sm:p-7 lg:p-9">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(17rem,40%)_minmax(0,1fr)] lg:gap-12">
        {/* Cover and its restrained, track-derived atmosphere. */}
        <div className="relative mx-auto w-full max-w-md md:mx-0">
          <div
            aria-hidden="true"
            className="absolute inset-8 scale-105 rounded-[2rem] opacity-35 blur-3xl"
            style={{ background: artworkGradient }}
          />
          <div
            className="relative aspect-square overflow-hidden rounded-2xl bg-[var(--panel-2)] shadow-2xl shadow-black/40 ring-1 ring-white/10"
            style={{ background: artworkGradient }}
          >
            {cover ? (
              <img
                src={cover}
                alt={track?.album || track?.title || 'cover'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full" style={{ background: artworkGradient }} />
            )}

            {playing && (
              <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-md">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--signal)] pulse-ring" />
                Live
              </div>
            )}
          </div>
        </div>

        {/* Editorial track metadata. */}
        <div className="flex min-w-0 flex-col justify-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--signal)]">
            Now playing
          </p>

          {!ready ? (
            <div className="space-y-4" aria-label="Loading track information">
              <div className="h-10 w-5/6 animate-pulse rounded bg-[var(--panel-2)]" />
              <div className="h-6 w-1/2 animate-pulse rounded bg-[var(--panel-2)]" />
            </div>
          ) : (
            <>
              <h1 className="break-words text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                {track?.title || 'Unknown track'}
              </h1>
              <p className="mt-3 break-words text-xl font-semibold tracking-[-0.02em] text-[var(--accent)] sm:text-2xl">
                {track?.artist || 'Unknown artist'}
              </p>
              {(track?.album || track?.year) && (
                <p className="mt-2 break-words text-sm leading-relaxed text-[var(--muted)]">
                  {track?.album}
                  {track?.album && track?.year ? ' · ' : ''}
                  {track?.year || ''}
                </p>
              )}

              {chips.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2.5" aria-label="Track signals">
                  {chips.map((chip, index) => (
                    <SignalLabel key={`${chip}-${index}`}>{chip}</SignalLabel>
                  ))}
                </div>
              )}
            </>
          )}

          {/* This indicates elapsed time only; live radio intentionally has no seek control. */}
          <div className="mt-8 border-t border-[var(--line)] pt-5">
            <div
              aria-hidden="true"
              className="h-1 w-full overflow-hidden rounded-full bg-[var(--panel-2)]"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-[width] duration-1000 ease-linear"
                style={{ width: `${duration > 0 ? pct : 12}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs tabular-nums text-[var(--muted)]">
              <span>{clock(elapsed)}</span>
              <span>{duration > 0 ? clock(duration) : 'live'}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
