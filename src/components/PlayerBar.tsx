// The transport row: tune-in / play-pause, volume, selected stream quality,
// and live station vitals. Takes the Player from usePlayer; reads vitals from
// the shared feed. Live radio intentionally has no seek or skip controls.
//
// LONGWAVE: no longer a card — a rule-bounded bar that sticks to the bottom of
// the viewport below `lg`, so the Tune In gesture is always within thumb reach.

import { useEffect } from 'react';
import { useStationFeed } from '@/hooks/useStationFeed';
import { useCast, type ReceiverState } from '@/hooks/useCast';
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

/** The Cast glyph — broadcast waves into a base. Monochrome ink by default,
 *  ember when a session is active. */
function CastIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
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

// What the receiver says it is doing with the stream, in rail language.
// 'finished'/'stopped'/'error' are the three ways the Cast protocol reports an
// idle receiver that *had* media (there is no ENDED player state — it is
// always IDLE plus an idleReason, which useCast has already classified).
const RECEIVER_STATUS: Record<ReceiverState, string> = {
  playing: 'playing',
  buffering: 'buffering…',
  paused: 'paused on speaker',
  finished: 'stream ended',
  stopped: 'stopped on speaker',
  error: 'receiver error',
  idle: 'waiting for stream',
  unknown: 'connecting',
};

export function PlayerBar({ player }: { player: Player }) {
  const { nowPlaying } = useStationFeed();
  const cast = useCast();
  const casting = cast.state === 'connected';
  const castConnecting = cast.state === 'connecting';
  const tokens = nowPlaying?.llmTokens ?? null;

  // When a cast session takes over, hand local playback off — the speaker is
  // now the room's output, and two copies of the same live stream would echo
  // across the house. Disconnecting never force-starts local audio: the live
  // stream goes stale while paused, and auto-playing without a fresh gesture
  // would be surprising (and often blocked by autoplay policy).
  useEffect(() => {
    if (cast.state === 'connected') player.stop();
    // player's functions are stable per mount; only the cast transition matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cast.state]);

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

  const busy = loading || castConnecting;
  const buttonLabel = casting
    ? 'Stop cast'
    : castConnecting
      ? 'Connecting…'
      : playing
        ? 'Pause'
        : tunedIn
          ? 'Play'
          : 'Tune in';
  const stateTitle = casting
    ? 'On speakers'
    : castConnecting
      ? 'Connecting…'
      : loading
        ? 'Buffering…'
        : playing
          ? 'On air'
          : tunedIn
            ? 'Paused'
            : 'Ready to listen';
  // Receiver-reported media state while casting — the ground truth for
  // "connected but silent". 'playing' is NOT the same as audible on this
  // deployment: the Default Media Receiver reports PLAYING immediately after
  // a load, and on this firmware the playback clock lags reality by minutes
  // (measured 2026-09-01: mount fetched 3s in, audio audible ~3 min, clock
  // only advancing past ~7 min). The clock moving is treated as confirmation;
  // until then the rail says "warming up…".
  const rawStatus = RECEIVER_STATUS[cast.receiverState];
  const playingLabel =
    cast.receiverState === 'playing'
      ? typeof cast.receiverPosition === 'number' && cast.receiverPosition > 0
        ? `playing · t+${Math.round(cast.receiverPosition)}s`
        : 'warming up… (audio starts in a few minutes)'
      : rawStatus;
  // 'live' only ever appears if the watchdog had to re-load in the other
  // stream mode, so showing it is worth the extra words — it says which path
  // the receiver was last asked for.
  const castMode = cast.streamMode === 'live' ? ' (live mode)' : '';
  // A failed retry is reported rather than swallowed: the receiver state alone
  // can look identical to a healthy one that simply hasn't started yet.
  const castProblem = cast.loadError ? ` · ${cast.loadError}` : '';
  // The receiver's derived duration: a finite number means it built a seekable
  // window out of Icecast's fake Content-Range total (the failure this whole
  // cast pipeline exists to prevent); absent/endless is the healthy shape.
  const rm = cast.receiverMedia;
  const receiverWindow =
    rm &&
    typeof rm.duration === 'number' &&
    Number.isFinite(rm.duration) &&
    rm.duration > 0
      ? ` · receiver window ${(rm.duration / 3600).toFixed(1)}h`
      : '';
  const stateDetail = casting
    ? `Casting to ${cast.deviceName ?? 'speaker'} · ${playingLabel}${castMode}${castProblem}${receiverWindow}`
    : cast.castError
      ? cast.castError
      : playing
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
            onClick={() => (casting ? void cast.stop() : toggle())}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-[4px] bg-[var(--ember)] px-4 text-[13px] font-semibold uppercase tracking-[0.12em] sm:px-5 sm:tracking-[0.14em] text-[var(--paper)] transition-[filter,transform] hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:pointer-events-none disabled:opacity-60"
            aria-label={buttonLabel}
            aria-busy={busy}
            disabled={castConnecting}
          >
            {busy ? <Spinner /> : playing || casting ? <PauseIcon /> : <PlayIcon />}
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
          {/* Volume is local-only; while casting, the speaker's own volume
              applies and this control is dimmed (the cast dialog has its own). */}
          <div
            className={`flex min-w-0 flex-1 items-center gap-3 sm:w-44 sm:flex-none ${
              casting ? 'pointer-events-none opacity-40' : ''
            }`}
            title={casting ? 'Speaker volume is set from the cast dialog' : undefined}
          >
            <button
              onClick={toggleMute}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-[var(--pencil)] transition-colors hover:bg-[var(--leaf-raised)] hover:text-[var(--graphite)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:pointer-events-none"
              aria-label={muted ? 'Unmute' : 'Mute'}
              disabled={casting}
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
              className="h-[2px] min-w-0 flex-1 cursor-pointer appearance-none bg-[var(--leaf-raised)] accent-[var(--ember)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--paper)] disabled:pointer-events-none"
              aria-label="Volume"
              disabled={casting}
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
            {tokens != null && <Vital label="DJ tokens" value={compact(tokens)} />}
          </div>

          {/* Cast: rendered only where the SDK is loaded and cast devices are
              in range (Chrome on desktop + Android, same Wi-Fi). Idle → opens
              the device picker; connected → ends the session. */}
          {cast.supported && (
            <button
              onClick={() => (casting ? void cast.stop() : void cast.cast())}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:pointer-events-none disabled:opacity-60 ${
                casting
                  ? 'bg-[var(--leaf-raised)] text-[var(--ember)]'
                  : 'text-[var(--pencil)] hover:bg-[var(--leaf-raised)] hover:text-[var(--graphite)]'
              }`}
              aria-label={
                castConnecting
                  ? 'Connecting to speaker'
                  : casting
                    ? `Stop casting to ${cast.deviceName ?? 'speaker'}`
                    : 'Cast to speaker'
              }
              aria-pressed={casting}
              aria-busy={castConnecting}
              title={
                castConnecting
                  ? 'Connecting to speaker'
                  : casting
                    ? 'Stop casting'
                    : 'Cast to speaker'
              }
              disabled={castConnecting}
            >
              <CastIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
