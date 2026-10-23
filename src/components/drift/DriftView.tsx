// Drift — a port of upstream SUB/WAVE's Drift player skin, inked in Classic
// Dark. Cover-tinted colour pools drift behind a sparse typographic centre
// stack; everything else lives in the four corners.

import { useEffect, useRef, useState } from 'react';
import './Drift.css';
import { useStationFeed } from '@/hooks/useStationFeed';
import { usePlayer } from '@/hooks/usePlayer';
import { useCast } from '@/hooks/useCast';
import { useRequest } from '@/hooks/useRequest';
import { useElapsed } from '@/hooks/useElapsed';
import { useMediaSession } from '@/hooks/useMediaSession';
import { useCoverColors } from '@/hooks/useCoverColors';
import { useCrossfade } from '@/hooks/useCrossfade';
import { coverUrl } from '@/lib/stationClient';
import { clock as fmtTime, listenerCount as listenerCountOf } from '@/lib/format';
import {
  contextLine,
  entryTime,
  lastVoiceLine,
  progressRatio,
  stationIdentity,
  stationWeekday,
  turnClock,
} from '@/lib/drift';
import type { StationContext, StationLocale } from '@/lib/types';

const REQUEST_NAME_MAX = 40;

/* Keep in step with .drift-layer's opacity transition in Drift.css. */
const WASH_FADE_MS = 20_000;

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Headphones glyph, stroke 1.5, 12px, sitting on the run's cap centre. */
function HeadphonesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative top-[0.1em]"
    >
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

/** One drifting pool of colour; a new colour crossfades in on the hidden layer. */
function Wash({ color, className }: { color: string; className: string }) {
  const { layers, front } = useCrossfade(color, WASH_FADE_MS);
  return (
    <div aria-hidden="true" className={cn('drift-wash', className)}>
      <WashLayer color={layers[0]} front={front === 0} />
      <WashLayer color={layers[1]} front={front === 1} />
    </div>
  );
}

function WashLayer({ color, front }: { color: string; front: boolean }) {
  return (
    <div
      className={cn('drift-layer', front && 'drift-front')}
      style={{ ['--sw-drift-c' as string]: color }}
    />
  );
}

/** "02:21 pm monday · late night", or just the context before the first tick.
 *  Ticks once a second in its own leaf so the skin root doesn't re-render. */
function ClockLine({
  timezone,
  locale,
  context,
}: {
  timezone: string | null;
  locale: StationLocale;
  context: StationContext | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      {[`${turnClock(now.getTime(), timezone, locale)} ${stationWeekday(now, timezone)}`, contextLine(context)]
        .filter(Boolean)
        .join(' · ')}
    </>
  );
}

function Progress({ trackId, duration }: { trackId: string | undefined; duration: number }) {
  const elapsed = useElapsed(trackId, true);
  const ratio = progressRatio(elapsed, duration) ?? 0;
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="font-mono text-[11px] text-ink/70">{fmtTime(elapsed)}</span>
      <div className="relative h-[3px] w-[min(260px,50vw)] bg-[color-mix(in_oklab,var(--ink)_18%,transparent)]">
        <div
          className="absolute top-0 bottom-0 left-0 bg-[var(--accent)]"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <span className="font-mono text-[11px] text-ink/70">{fmtTime(duration)}</span>
    </div>
  );
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

export function DriftView() {
  const player = usePlayer();
  const cast = useCast();
  const request = useRequest();
  const feed = useStationFeed();
  const np = feed.nowPlaying;
  const track = np?.nowPlaying ?? null;
  const context = np?.context ?? null;
  const state = feed.state;
  const timezone = np?.timezone ?? state?.timezone ?? null;
  const stationLocale: StationLocale = np?.locale ?? state?.locale ?? 'en-US';
  const activeShow = np?.activeShow ?? context?.activeShow ?? null;
  const offline = feed.ready && !feed.online;

  const { tunedIn, playing, volume, muted } = player;
  const casting = cast.state === 'connected';
  const castConnecting = cast.state === 'connecting';

  useMediaSession(track, np?.dj?.station, playing, {
    // While a cast session owns the room, the phone's transport (lock screen,
    // headphone buttons) must not start a second copy of the stream locally —
    // same "stray tap must not disturb the shared stream" rule as skip/seek.
    onPlay: () => {
      if (cast.state !== 'connected') player.tuneIn();
    },
    onPause: () => {
      if (cast.state !== 'connected') player.toggle();
    },
  });

  // When a cast session takes over, hand local playback off — two copies of the
  // same live stream would echo across the house.
  useEffect(() => {
    if (cast.state === 'connected') player.stop();
    // player's functions are stable per mount; only the cast transition matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cast.state]);

  const showOverlay = !tunedIn && !casting;
  const tuneInFromOverlay = () => player.tuneIn();
  const handleTune = () => {
    if (casting) return;
    if (!tunedIn) player.tuneIn();
    // Stopping mid-connect cancels the attempt instead of restarting it.
    else if (playing || player.loading) player.stop();
    else player.tuneIn();
  };
  // Shared by the visible hint and the title's accessible name so they can't drift.
  const tuneAction = casting ? null : playing || player.loading ? 'stop' : 'listen';

  const listenerCount = listenerCountOf(np?.listeners);
  const { stationName, djName, showName } = stationIdentity(np?.dj, activeShow, context);
  const voice = lastVoiceLine(feed.session?.messages ?? []);
  const upNext = state?.upcoming?.[0];
  const duration = track?.duration;

  const coverId = track?.subsonic_id ?? null;
  const coverSrc = coverId ? coverUrl(coverId) : null;
  const colors = useCoverColors(coverSrc);
  const c1 = colors.vibrant ?? 'var(--accent)';
  const c2 = colors.average ?? 'var(--muted)';

  const adjustVolume = (delta: number) =>
    player.setVolume(Math.min(1, Math.max(0, volume + delta)));

  // One key per airing: offline and the placeholder collapse to constants so a
  // transient null from the 5s /state poll can't re-fire the dissolve mid-track.
  const trackKey = offline
    ? 'offline'
    : coverId
      ? `s:${coverId}`
      : track?.title
        ? `t:${track.title}`
        : 'placeholder';

  const [panelOpen, setPanelOpen] = useState(false);
  const [reqText, setReqText] = useState('');
  const [reqName, setReqName] = useState('');
  const reqInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (panelOpen) reqInputRef.current?.focus();
  }, [panelOpen]);

  const req = request.state;
  const sending = req.phase === 'submitting' || req.phase === 'pending';
  const ack =
    req.phase !== 'done'
      ? null
      : req.status === 'resolved'
        ? 'the DJ has it.'
        : req.error
          ? 'the booth line is down.'
          : 'not this time.';

  // Latest-handler ref so the key listener is registered once.
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keysRef.current = (e) => {
      if (e.key === 'Escape') {
        if (panelOpen) setPanelOpen(false);
        return;
      }
      if (panelOpen || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // A focused button already turns Space into a click.
      if (k === ' ' && (e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      if (k === ' ' || k === 'k') handleTune();
      else if (k === 'arrowup') adjustVolume(0.05);
      else if (k === 'arrowdown') adjustVolume(-0.05);
      else if (k === 'm') player.toggleMute();
      else if (k === 'r') setPanelOpen(true);
      else return;
      e.preventDefault();
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const history = (state?.history ?? []).slice(0, 3);
  const metaLine = [
    track?.artist,
    [
      [track?.album, track?.year].filter(Boolean).join(' · '),
      track?.genre?.toLowerCase(),
      track?.energy ?? undefined,
    ]
      .filter(Boolean)
      .join(' · '),
  ]
    .filter(Boolean)
    .join(' — ');

  const castStatus = cast.castError
    ? cast.castError
    : cast.loadError
      ? cast.loadError
      : casting && cast.receiverState !== 'unknown'
        ? cast.receiverState
        : null;

  return (
    <div className="absolute inset-0 overflow-hidden font-sans text-ink">
      <Wash
        color={`color-mix(in oklab, ${c1} 29%, transparent)`}
        className="drift-washA top-[-20%] left-[-10%] h-[70vmax] w-[70vmax]"
      />
      <Wash
        color={`color-mix(in oklab, ${c2} 34%, transparent)`}
        className="drift-washB right-[-14%] bottom-[-28%] h-[85vmax] w-[85vmax]"
      />
      <Wash
        color="color-mix(in oklab, var(--accent) 10%, transparent)"
        className="drift-washC top-[-30%] left-[40%] h-[55vmax] w-[55vmax]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_55%,var(--overlay))]"
        aria-hidden="true"
      />

      <h1 className="sr-only">{track?.title ?? stationName}</h1>

      <div className="absolute top-7 left-8 max-w-[70%] truncate font-mono text-[11px] tracking-[0.24em] text-ink uppercase sm:max-w-[45%]">
        {stationName} — {showName ? `${showName} with ${djName}` : `small hours with ${djName}`}
      </div>
      <div className="absolute top-7 right-8 flex max-w-[45%] items-baseline gap-3 font-mono text-[11px]">
        <span className="hidden min-w-0 truncate tracking-[0.24em] text-muted uppercase sm:block">
          <ClockLine timezone={timezone} locale={stationLocale} context={context} />
        </span>
      </div>
      <div className="absolute bottom-7 left-8 max-w-[38%] truncate font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        {upNext?.title ? `up next · ${[upNext.title, upNext.artist].filter(Boolean).join(' — ')}` : ''}
      </div>
      <div className="absolute right-8 bottom-7 flex items-baseline gap-2 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        <span className="hidden items-baseline gap-1.5 sm:inline-flex">
          {listenerCount != null && (
            <span className="inline-flex items-baseline gap-1" aria-label={`${listenerCount} listening`}>
              <HeadphonesIcon />
              {listenerCount}
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label="Volume down"
          onClick={() => adjustVolume(-0.05)}
          className="v3-focus cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-ink"
        >
          −
        </button>
        <button
          type="button"
          onClick={player.toggleMute}
          className="v3-focus cursor-pointer border-0 bg-transparent p-0 text-muted uppercase hover:text-ink"
        >
          {muted ? 'muted' : `vol ${Math.round(volume * 100)}`}
        </button>
        <button
          type="button"
          aria-label="Volume up"
          onClick={() => adjustVolume(0.05)}
          className="v3-focus cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-ink"
        >
          +
        </button>
      </div>

      {/* Keep the title clickable without intercepting clicks on the corner controls. */}
      {!showOverlay && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          {coverSrc && !offline && (
            <div className="relative h-[128px] w-[128px] border border-soft-border sm:h-[152px] sm:w-[152px]">
              <img
                key={coverSrc}
                src={coverSrc}
                alt=""
                className="drift-cover-in absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}
          <div className="mt-2 font-mono text-[10px] tracking-[0.28em] text-accent-2 uppercase">
            {offline ? 'off air' : tuneAction ? `now playing — tap to ${tuneAction}` : 'now playing'}
          </div>
          {!offline && (
            <button
              key={`title:${trackKey}`}
              type="button"
              onClick={handleTune}
              aria-label={
                tuneAction
                  ? `${tuneAction === 'stop' ? 'Stop listening' : 'Listen'} — ${track?.title ?? 'somewhere on the dial'}`
                  : undefined
              }
              aria-disabled={casting || undefined}
              className="drift-type-in v3-focus pointer-events-auto max-w-full cursor-pointer border-0 bg-transparent p-0 font-display text-[clamp(26px,5vw,46px)] leading-[1.1] font-semibold text-ink"
            >
              {track?.title ?? 'somewhere on the dial'}
            </button>
          )}
          {!offline && metaLine && (
            <div
              key={`meta:${trackKey}`}
              className="drift-type-in max-w-full truncate font-mono text-[12px] tracking-[0.2em] text-ink/75 uppercase"
            >
              {metaLine}
            </div>
          )}
          {!offline && duration != null && duration > 0 && (
            <Progress trackId={track?.subsonic_id} duration={duration} />
          )}
          {voice && (
            <div className="mt-9 flex max-w-[520px] flex-col gap-2.5">
              <div className="font-display text-[clamp(15px,2.4vw,21px)] leading-normal italic">
                “{voice.text}”
              </div>
              <div className="font-mono text-[9px] tracking-[0.3em] text-muted uppercase">
                — {djName}, on air
              </div>
            </div>
          )}
        </div>
      )}

      {!showOverlay && (
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className="v3-focus absolute bottom-6 left-1/2 -translate-x-1/2 cursor-pointer border border-soft-border/50 bg-[var(--field)]/25 px-4 py-1 font-mono text-[12px] tracking-[0.3em] text-muted backdrop-blur-md hover:bg-[var(--field)]/45 hover:text-ink"
        >
          ···
        </button>
      )}

      {panelOpen && (
        <div className="absolute bottom-16 left-1/2 flex w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3 border border-soft-border bg-[var(--bg)]/90 p-4 backdrop-blur-sm">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void request.submit(reqText, reqName);
            }}
          >
            {ack ? (
              <div className="flex items-baseline gap-2.5">
                <span className="min-w-0 flex-1 text-[13px] italic">{ack}</span>
                <button
                  type="button"
                  onClick={() => {
                    request.reset();
                    setReqText('');
                  }}
                  className="v3-focus cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.2em] text-muted uppercase hover:text-ink"
                >
                  again
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2.5">
                  <input
                    ref={reqInputRef}
                    value={reqText}
                    onChange={(e) => setReqText(e.target.value)}
                    placeholder="ask the dj for something…"
                    className="v3-focus min-w-0 flex-1 border-0 border-b border-soft-border bg-transparent pb-1 text-[13px] text-ink italic outline-none placeholder:text-muted"
                  />
                  <button
                    type="submit"
                    disabled={sending || !reqText.trim()}
                    className={cn(
                      'v3-focus border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.2em] uppercase',
                      sending || !reqText.trim()
                        ? 'cursor-default text-muted opacity-60'
                        : 'cursor-pointer text-[var(--accent)] hover:opacity-80',
                    )}
                  >
                    {sending ? '…' : 'send'}
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">from</span>
                  <input
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="your name (optional)"
                    maxLength={REQUEST_NAME_MAX}
                    className="v3-focus min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-ink italic outline-none placeholder:text-muted/70"
                  />
                </div>
              </>
            )}
          </form>
          {history.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-soft-border pt-2.5">
              {history.map((h, i) => (
                <div
                  key={`${h.t ?? i}-${h.title ?? i}`}
                  className="flex gap-2.5 font-mono text-[10px] tracking-[0.14em] text-muted uppercase"
                >
                  <span>{turnClock(entryTime(h), timezone, stationLocale)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {h.title ?? '?'}
                    {h.artist ? ` — ${h.artist}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {cast.state !== 'unavailable' && (
            <div className="flex flex-col gap-1 border-t border-soft-border pt-2.5">
              <button
                type="button"
                disabled={castConnecting}
                aria-busy={castConnecting}
                onClick={() => (casting ? void cast.stop() : void cast.cast())}
                className="v3-focus w-fit cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.2em] text-muted uppercase hover:text-ink disabled:cursor-default disabled:opacity-60"
              >
                {casting
                  ? `casting · ${cast.deviceName ?? 'speaker'} — stop`
                  : castConnecting
                    ? 'connecting…'
                    : 'cast to speaker'}
              </button>
              {castStatus && (
                <div className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
                  {castStatus}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showOverlay && !offline && (
        <button
          type="button"
          onClick={tuneInFromOverlay}
          className="absolute inset-0 z-40 grid w-full cursor-pointer place-items-center border-0 bg-[color-mix(in_srgb,var(--bg)_30%,transparent)]"
        >
          <span className="drift-breathe font-display text-[clamp(28px,4vw,40px)] font-semibold text-ink lowercase">
            listen
          </span>
        </button>
      )}
    </div>
  );
}
