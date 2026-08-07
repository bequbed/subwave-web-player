// The transport row: tune-in / play-pause, volume, and the live station vitals
// (listener count, stream bitrate, and the cumulative LLM-token ticker the DJ
// has spent talking). Takes the Player from usePlayer; reads vitals from the
// shared feed.

import { useStationFeed } from '@/hooks/useStationFeed';
import type { Player } from '@/hooks/usePlayer';
import { compact, listenerCount } from '@/lib/format';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden>
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
    <div className="flex flex-col items-center leading-tight">
      <span className="text-sm font-semibold tabular-nums text-[var(--fg)]">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</span>
    </div>
  );
}

export function PlayerBar({ player }: { player: Player }) {
  const { nowPlaying } = useStationFeed();
  const listeners = listenerCount(nowPlaying?.listeners);
  const bitrate = nowPlaying?.streamBitrate ?? null;
  const tokens = nowPlaying?.llmTokens ?? null;

  const { playing, loading, toggle, tunedIn, volume, setVolume, muted, toggleMute } = player;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 sm:gap-6 sm:px-5">
      {/* Play / tune-in */}
      <button
        onClick={toggle}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-black shadow-lg transition hover:brightness-110 active:scale-95"
        aria-label={playing ? 'Pause' : tunedIn ? 'Play' : 'Tune in'}
      >
        {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {!tunedIn && !playing ? (
        <span className="text-sm text-[var(--muted)]">
          Tap to tune in — <span className="text-[var(--fg)]">live radio</span>, no rewind.
        </span>
      ) : (
        <span className="text-sm font-medium text-[var(--accent)]">
          {loading ? 'Buffering…' : playing ? 'On air' : 'Paused'}
        </span>
      )}

      <div className="ml-auto flex items-center gap-4 sm:gap-6">
        {/* Volume */}
        <div className="hidden items-center gap-2 sm:flex">
          <button
            onClick={toggleMute}
            className="text-[var(--muted)] transition hover:text-[var(--fg)]"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-[var(--panel-2)] accent-[var(--accent)]"
            aria-label="Volume"
          />
        </div>

        <div className="flex items-center gap-4 sm:gap-5">
          {listeners != null && <Vital label="listening" value={String(listeners)} />}
          {bitrate != null && <Vital label="kbps" value={String(bitrate)} />}
          {tokens != null && <Vital label="DJ tokens" value={compact(tokens)} />}
        </div>
      </div>
    </div>
  );
}
