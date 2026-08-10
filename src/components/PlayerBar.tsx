// The transport row: tune-in / play-pause, volume, selected stream quality,
// and live station vitals. Takes the Player from usePlayer; reads vitals from
// the shared feed. Live radio intentionally has no seek or skip controls.
//
// LONGWAVE: no longer a card — a rule-bounded bar that sticks to the bottom of
// the viewport below `lg`, so the Tune In gesture is always within thumb reach.

import { useStationFeed } from '@/hooks/useStationFeed';
import type { Player } from '@/hooks/usePlayer';
import { compact } from '@/lib/format';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Speaker glyph drawn rather than emoji, so the bar stays monochrome ink. */
function SpeakerIcon({ level }: { level: 'mute' | 'low' | 'high' }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {level === 'mute' ? (
        <path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <>
          <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          {level === 'high' && (
            <path d="M18.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          )}
        </>
      )}
    </svg>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="text-sm font-semibold tabular-nums text-[var(--graphite)]">{value}</span>
      <span className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--pencil)]">
        {label}
      </span>
    </div>
  );
}

export function PlayerBar({ player }: { player: Player }) {
  const { nowPlaying } = useStationFeed();
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

  // Display-only. The bitrate isn't verifiable client-side, so only the codec
  // is ever claimed here.
  const qualityLabel =
    quality === 'flac'
      ? 'FLAC · lossless'
      : quality === 'mp3'
        ? 'MP3'
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

  const level = muted || volume === 0 ? 'mute' : volume < 0.5 ? 'low' : 'high';

  return (
    // Below `lg` the rail is pinned to the viewport, not to a section. Sticky
    // can only pin a box within its own containing block, so any sticky rail
    // here rides offscreen the moment the hero scrolls away; fixed is the only
    // treatment that keeps the Tune In gesture reachable down the whole page.
    // App.tsx reserves the matching bottom padding so nothing hides behind it.
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--rule)] bg-[var(--paper)] px-6 py-3.5 shadow-[var(--plate-shadow)] sm:px-10 lg:static lg:border-y lg:px-0 lg:py-5 lg:shadow-none">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 lg:max-w-none lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        {/* The only transport: tune in at the live edge or pause. */}
        <div className="flex min-w-0 items-center gap-4 lg:flex-1">
          <button
            onClick={toggle}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-[4px] bg-[var(--ember)] px-4 text-[13px] font-semibold uppercase tracking-[0.12em] sm:px-5 sm:tracking-[0.14em] text-[var(--paper)] transition-[filter,transform] hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
            aria-label={buttonLabel}
            aria-busy={loading}
          >
            {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
            <span>{buttonLabel}</span>
          </button>

          <div className="min-w-0 flex-1 basis-0" aria-live="polite">
            <p className="break-words text-sm font-semibold text-[var(--graphite)]">{stateTitle}</p>
            <p className="mt-0.5 break-words text-[11px] leading-[1.4] text-[var(--pencil)]">
              {stateDetail}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:gap-6 lg:justify-end lg:gap-8">
          {/* Volume remains the only continuous control. */}
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-44 sm:flex-none">
            <button
              onClick={toggleMute}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-[var(--pencil)] transition-colors hover:bg-[var(--leaf-raised)] hover:text-[var(--graphite)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              <SpeakerIcon level={level} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-[2px] min-w-0 flex-1 cursor-pointer appearance-none bg-[var(--leaf-raised)] accent-[var(--ember)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--paper)]"
              aria-label="Volume"
            />
          </div>

          {qualityLabel && (
            <p
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pencil)]"
              aria-live="polite"
            >
              {qualityLabel}
            </p>
          )}

          {/* Secondary vitals stay off the compact mobile rail. */}
          <div className="hidden flex-wrap items-center gap-x-6 gap-y-3 sm:flex sm:justify-end">
            {bitrate != null && <Vital label="kbps" value={String(bitrate)} />}
            {tokens != null && <Vital label="DJ tokens" value={compact(tokens)} />}
          </div>
        </div>
      </div>
    </div>
  );
}
