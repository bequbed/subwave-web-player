// The transport row: tune-in / play-pause, volume, selected stream quality,
// and live station vitals. Takes the Player from usePlayer; reads vitals from
// the shared feed. Live radio intentionally has no seek or skip controls.

import { useStationFeed } from '@/hooks/useStationFeed';
import type { Player } from '@/hooks/usePlayer';
import { compact, listenerCount } from '@/lib/format';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="text-sm font-semibold tabular-nums text-[var(--fg)]/85">{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </span>
    </div>
  );
}

export function PlayerBar({ player }: { player: Player }) {
  const { nowPlaying } = useStationFeed();
  const listeners = listenerCount(nowPlaying?.listeners);
  const bitrate = nowPlaying?.streamBitrate ?? null;
  const tokens = nowPlaying?.llmTokens ?? null;

  const {
    playing,
    loading,
    quality,
    toggle,
    tunedIn,
    volume,
    setVolume,
    muted,
    toggleMute,
  } = player;

  const qualityLabel =
    quality === 'flac'
      ? 'FLAC · lossless'
      : quality === 'mp3'
        ? `MP3 · ${bitrate ?? 'live'} kbps`
        : loading
          ? 'Selecting quality…'
          : null;

  const buttonLabel = playing ? 'Pause' : tunedIn ? 'Play' : 'Tune in';
  const stateTitle = loading ? 'Buffering…' : playing ? 'On air' : tunedIn ? 'Paused' : 'Ready to listen';
  const stateDetail = playing
    ? 'Live signal connected'
    : tunedIn
      ? 'Tune in again at the live edge'
      : 'Live radio · no rewind';

  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-xl shadow-black/15 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* The only transport: tune in at the live edge or pause. */}
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <button
            onClick={toggle}
            className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 rounded-2xl bg-[var(--signal)] px-5 font-bold text-black shadow-lg shadow-black/25 transition-[transform,filter,box-shadow] hover:brightness-105 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]"
            aria-label={buttonLabel}
            aria-busy={loading}
          >
            {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
            <span>{buttonLabel}</span>
          </button>

          <div className="min-w-0 flex-1 basis-36" aria-live="polite">
            <p className="text-sm font-semibold text-[var(--fg)]">{stateTitle}</p>
            <p className="mt-0.5 break-words text-xs leading-relaxed text-[var(--muted)]">
              {stateDetail}
            </p>
          </div>
        </div>

        {qualityLabel && (
          <div
            className="w-fit rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
            aria-live="polite"
          >
            {qualityLabel}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Volume remains the only continuous control. */}
        <div className="flex min-w-0 items-center gap-3 sm:w-48">
          <button
            onClick={toggleMute}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <span aria-hidden="true">{muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--panel-2)] accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]"
            aria-label="Volume"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:justify-end">
          {listeners != null && <Vital label="listening" value={String(listeners)} />}
          {bitrate != null && <Vital label="kbps" value={String(bitrate)} />}
          {tokens != null && <Vital label="DJ tokens" value={compact(tokens)} />}
        </div>
      </div>
    </div>
  );
}
