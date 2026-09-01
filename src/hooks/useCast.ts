// Google Cast (Chromecast) sender support for the player rail.
//
// Live radio is a *shared stream*: when a cast session takes over, the speaker
// fetches https://<station>/stream.mp3 itself — the phone only steers. So this
// hook casts the same MP3 mount the <audio> element would play (the universal
// floor; the Ogg-FLAC mount is a browser-only nicety), and the rail hands
// local playback off to the receiver.
//
// Browser reality: the Web Sender SDK is Chrome-only (desktop + Android).
// iOS Safari / Firefox never load the SDK, so the hook stays 'unavailable' and
// the cast button never renders there. Discovery additionally requires the
// phone and the speakers on the same Wi-Fi — casting from outside the house is
// not possible with this SDK, which is fine for its job here.
//
// Metadata note: the Default Media Receiver shows only what it gets at load
// time — it cannot receive per-track metadata updates without restarting the
// stream. The title/artist snapshot below is therefore taken once, at cast
// time; the audio itself is unaffected.
//
// Why BUFFERED and not LIVE (the "connects but silent" bug)
// --------------------------------------------------------
// Icecast advertises `Accept-Ranges: bytes` on a live mount and answers any
// *bounded* range request with `206` + a fabricated total of 1073741823 bytes
// (0x3FFFFFFF) — verified against a live mount: `bytes=0-2047` and
// `bytes=1073739776-1073741823` return byte-identical data, and a range past
// the claimed total still returns `206` instead of `416`. The offset is
// ignored; every read yields the current live position.
//
// So to a media pipeline the mount looks like a seekable ~7.5 hour 320kbps
// file. With `streamType = LIVE` the receiver builds a seekable/DVR window out
// of that bogus length and positions playback at the live edge — the *end* of
// a window that is hours past any real audio. The load succeeds, the session
// stays healthy, and the speaker plays nothing.
//
// An *open-ended* `Range: bytes=0-` is served as a plain `200` with no length
// and a continuous body — the healthy path the local <audio> element already
// uses. On the receivers this was tested against, BUFFERED + `currentTime = 0`
// is what produced that open-ended read; CAF documents start-position
// semantics, not the resulting HTTP request shape, so treat this as observed
// behaviour of those receivers and this mount rather than a guarantee. The
// watchdog further down exists precisely because another firmware may not
// behave the same way.
//
// UPDATE (2026-08-12, hardware evidence): the deployment's Caddy now strips
// Range on the stream routes (Icecast's fake 206 can no longer be observed,
// so no receiver can derive the seekable window at all — the original reason
// for BUFFERED is gone server-side). On the user's actual speakers, BUFFERED
// casts reported PLAYING but never produced audio, while the native app's
// LIVE casts (no duration override) are the only ones ever observed to play.
// So 'live' is the primary mode now, with the watchdog falling back to
// 'buffered' for receivers that behave the opposite way round.

import { useEffect, useRef, useState } from 'react';
import { config } from '@/config';
import { coverUrl } from '@/lib/stationClient';
import { useStationFeed } from '@/hooks/useStationFeed';

export type CastState = 'unavailable' | 'idle' | 'connecting' | 'connected';

/** What the receiver reports about the loaded stream, polled while connected.
 *  'unknown' before the first status arrives (or while not casting).
 *
 *  The Cast media protocol has only IDLE / BUFFERING / PAUSED / PLAYING —
 *  there is no ENDED player state. Completion and failure both arrive as IDLE
 *  plus an `idleReason`, which is what 'finished' / 'stopped' / 'error'
 *  classify below. */
export type ReceiverState =
  | 'unknown'
  | 'idle'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'finished'
  | 'stopped'
  | 'error';

/** How the stream was described to the receiver. 'live' is the primary mode:
 *  the native app casts LIVE on this deployment (the only config observed to
 *  produce audio on the user's speakers); 'buffered' only appears if the
 *  watchdog below had to fall back to it. */
export type StreamMode = 'buffered' | 'live';

/** The receiver's own view of the loaded media — the ground truth for what
 *  the speaker believes it is playing. A finite `duration` here means the
 *  receiver built a seekable window out of Icecast's fake Content-Range total
 *  (the exact failure this module exists to prevent); `null`/`-1`/endless is
 *  the healthy shape. `contentId` is the URL it was handed, with the ?t= bust. */
export interface ReceiverMediaView {
  /** Seconds, as derived by the receiver (a finite number = fake window leaked). */
  duration: number | null;
  /** Position (s) the receiver believes it is at. */
  currentTime: number | null;
  /** The URL the receiver is (or was asked to) play. */
  contentId: string;
}

/** If a load was accepted but the receiver shows no sign of playing it — no
 *  media session at all, or IDLE / an error — reload once in the other stream
 *  mode. Covers the case where a receiver firmware behaves the opposite way
 *  round to the one diagnosed. */
const FALLBACK_AFTER_MS = 10000;

/** A receiver that is actively BUFFERING is fetching the mount, just slowly
 *  (cold Wi-Fi, a distant Icecast). Replacing a viable BUFFERED load with the
 *  mode already known to be wrong for this mount would make that *worse*, so
 *  buffering gets a much longer rope than silence does. */
const BUFFERING_FALLBACK_AFTER_MS = 45000;
/** Some Default Media Receiver versions report PLAYING immediately for a live
 *  mount, while their playback clock stays at zero — and on the JBL BAR
 *  (CrKey/1.56.500000, measured 2026-09-01 with a pychromecast replica of this
 *  hook's exact load) the clock is NOT a warm-up signal at all: the mount was
 *  being fetched 3s after the load and audio was audibly playing, yet
 *  currentTime still read 0 four minutes in and only started advancing past
 *  ~7 min. The clock lag on this firmware is real but the decode is not, so
 *  the fallback must not fire inside that window: 10 minutes covers the worst
 *  observed lag with margin. The cost: a genuinely dead receiver — whose
 *  frozen PLAYING is indistinguishable from a healthy one — sits in this
 *  state for the full window; stopping the cast by hand is the only faster
 *  recovery (re-casting retries LIVE, the only mode observed to play here;
 *  the alternate-mode attempt happens only when this window expires). */
const FROZEN_PLAYING_FALLBACK_AFTER_MS = 600000;

/** Google's built-in Default Media Receiver — usable without any registration
 *  or API keys (https://developers.google.com/cast/docs/web_sender). */
const DEFAULT_RECEIVER_APP_ID = 'CC1AD845';

let castApiPromise: Promise<boolean> | null = null;

/** Resolve once the Cast SDK signals readiness, or give up after 8s so a
 *  blocked script (adblocker, offline) can never hang the UI. Unsupporting
 *  browsers hit the timeout and report 'unavailable' — their cast button
 *  simply never renders. */
function waitForCastApi(): Promise<boolean> {
  if (!castApiPromise) {
    castApiPromise = new Promise((resolve) => {
      if (window.cast?.framework) {
        resolve(true);
        return;
      }
      const onReady = () => {
        window.removeEventListener('cast-api-ready', onReady);
        resolve(Boolean(window.__castApiAvailable));
      };
      window.addEventListener('cast-api-ready', onReady);
      window.setTimeout(() => {
        window.removeEventListener('cast-api-ready', onReady);
        resolve(Boolean(window.cast?.framework));
      }, 8000);
    });
  }
  return castApiPromise;
}

/** The legacy `chrome.cast` media namespace lives beside `window.cast`.
 *  lib.dom owns the `chrome` global's type, so reach it via an explicit cast. */
function chromeCast(): CastMediaNamespace | null {
  const w = window as unknown as { chrome?: { cast?: CastMediaNamespace } };
  return w.chrome?.cast ?? null;
}

let contextInitAttempted = false;

// ---------------------------------------------------------------------------
// Session bookkeeping — module scope, deliberately.
//
// There is exactly one receiver and one SDK-wide CastContext, but the app
// mounts useCast more than once (App for the media-session guard, PlayerBar
// for the rail). Per-instance refs would give each copy its own attempt token,
// its own pending-start flag and its own watchdog — two watchdogs racing to
// "fix" the same session with two competing fallback loads. One session, one
// set of facts; React state below is only each instance's view of it.
// ---------------------------------------------------------------------------

/** Monotonic operation token: bumped on every start, stop, and externally
 *  observed session end/failure, so a stale requestSession/loadMedia can never
 *  touch a session it doesn't own. */
let attemptToken = 0;
/** Synchronous in-flight guard: the picker's CONNECTING state arrives via an
 *  async event, so render state alone cannot stop a double-click opening two
 *  pickers before that event lands. */
let startInFlight = false;
/** Set when the user asks to cast; consumed by whichever signal first has a
 *  usable session in hand (see consumePendingStart). */
let pendingStart = false;
let pendingStartAttempt = 0;
/** The session the bookkeeping below describes. Every post-await write and
 *  every teardown is guarded on this as well as the attempt token: a resumed
 *  or replaced session must not inherit — or be torn down by — the previous
 *  one's in-flight work. */
let activeSession: CastSession | null = null;
// Per-session watchdog state: when the last load was accepted, in which mode,
// whether the receiver has ever actually played it, whether the watchdog has
// been disarmed (deliberate pause / stop), and whether the one permitted
// fallback reload has been spent.
let loadedAt = 0;
let loadedMode: StreamMode = 'buffered';
let sawPlaying = false;
let watchdogDisarmed = false;
let fallbackUsed = false;
// Shared view state, mirrored into every mounted instance by the 1s poll so
// the rail reports the same thing regardless of which instance did the load.
let streamModeValue: StreamMode | null = null;
let loadErrorValue: string | null = null;

function safeSessionId(session: CastSession | null): string | null {
  if (!session) return null;
  try {
    return session.getSessionId();
  } catch {
    return null;
  }
}

function safeFriendlyName(session: CastSession | null): string | null {
  if (!session) return null;
  try {
    return session.getSessionObj().receiver.friendlyName ?? null;
  } catch {
    return null;
  }
}

/** True when `session` is the one `activeSession` describes. Object identity is
 *  the normal answer; the id comparison is insurance against an SDK that hands
 *  back a fresh wrapper for the same session. */
function isActiveSession(session: CastSession | null): boolean {
  if (!session || !activeSession) return false;
  if (session === activeSession) return true;
  const id = safeSessionId(session);
  return id !== null && id === safeSessionId(activeSession);
}

/** Watchdog and mode state are per *session*, not per attempt — a resumed or
 *  replaced session must never inherit the previous one's "already saw
 *  playing" or "already spent the fallback" verdict. */
function resetSessionState(): void {
  loadedAt = 0;
  loadedMode = 'live';
  sawPlaying = false;
  watchdogDisarmed = false;
  fallbackUsed = false;
  streamModeValue = null;
  loadErrorValue = null;
}

/** How long to wait, given what the receiver currently reports, before calling
 *  a load dead — or null when falling back would be wrong.
 *
 *  PAUSED is somebody's decision (the cast mini-controller, a smart display's
 *  own transport); reloading with autoplay would restart audio a listener
 *  deliberately stopped. CANCELLED/INTERRUPTED likewise mean something took the
 *  media away on purpose — including our own replacement load. */
function fallbackDelayFor(
  playerState?: string,
  idleReason?: string,
  currentTime?: number | null,
): number | null {
  switch (playerState) {
    case 'PLAYING':
      // CAF announces PLAYING long before this firmware's clock moves
      // (measured: audio audible while currentTime still read 0 at 4 min).
      // A frozen zero clock is not *confirmation* of playback — the delay
      // below simply outlasts the worst observed clock lag before the
      // other mode is tried.
      return currentTime === null || currentTime === 0
        ? FROZEN_PLAYING_FALLBACK_AFTER_MS
        : null;
    case 'PAUSED':
      return null;
    case 'BUFFERING':
      return BUFFERING_FALLBACK_AFTER_MS;
    case 'IDLE':
      if (idleReason === 'CANCELLED' || idleReason === 'INTERRUPTED') return null;
      // ERROR, FINISHED, or no reason yet: the load is not going to start.
      return FALLBACK_AFTER_MS;
    default:
      // No media session at all — the receiver never picked the load up.
      return FALLBACK_AFTER_MS;
  }
}

function classifyReceiver(playerState?: string, idleReason?: string): ReceiverState {
  switch (playerState) {
    case 'PLAYING':
      return 'playing';
    case 'BUFFERING':
      return 'buffering';
    case 'PAUSED':
      return 'paused';
    case 'IDLE':
      if (idleReason === 'ERROR') return 'error';
      if (idleReason === 'FINISHED') return 'finished';
      if (idleReason === 'CANCELLED') return 'stopped';
      // INTERRUPTED (a replacement load is landing) or no reason yet: the
      // receiver has accepted something but isn't playing it.
      return 'idle';
    default:
      return 'unknown';
  }
}

export interface Cast {
  /** 'unavailable' until the SDK loads and finds devices; 'connected' while a
   *  session is active on a speaker. */
  state: CastState;
  /** Friendly name of the receiving device while connected. */
  deviceName: string | null;
  /** Receiver-reported media state ('playing'/'buffering'/'idle'...), polled
   *  once a second while a session is active. */
  receiverState: ReceiverState;
  /** Live playback position (s) the receiver reports, or null while no media
   *  session is attached. The rail shows "warming up…" while the state is
   *  'playing' but this stays 0 — on the JBL BAR's firmware the clock lags
   *  reality by minutes (measured: mount fetched 3s after the load and audio
   *  audible ~3 min in, yet currentTime still 0 at 4 min; advancing only
   *  past ~7 min), so a moving clock means playing, but a frozen one does
   *  NOT mean silent. */
  receiverPosition: number | null;
  /** Set when opening the device picker fails (requestSession rejected or
   *  hung). Rendered in the rail so a dead cast button is never silent. */
  castError: string | null;
  /** The receiver's own view of the loaded media (derived duration, position,
   *  URL), polled alongside receiverState. Null while not casting or when the
   *  receiver reports no media session. */
  receiverMedia: ReceiverMediaView | null;
  /** Which stream mode the receiver was last asked for, or null when nothing
   *  has been loaded. Set the moment a load is *dispatched*, so a hung or
   *  failed fallback can never leave the rail claiming the mode that already
   *  demonstrably didn't play. 'buffered' means the watchdog fell back from
   *  the primary live mode — worth surfacing, it is diagnostic. */
  streamMode: StreamMode | null;
  /** Set when a load attempt failed outright and the session was left up
   *  (the watchdog fallback). Rendered in the rail so a silent receiver is
   *  never reported as healthy. */
  loadError: string | null;
  /** True when the cast button should render. */
  supported: boolean;
  /** Open the device picker and start the stream on the chosen speaker. */
  cast: () => Promise<void>;
  /** Stop the stream on the receiver and end the session. */
  stop: () => Promise<void>;
}

export function useCast(): Cast {
  const { nowPlaying } = useStationFeed();
  const [state, setState] = useState<CastState>('unavailable');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [receiverState, setReceiverState] = useState<ReceiverState>('unknown');
  const [receiverPosition, setReceiverPosition] = useState<number | null>(null);
  const [castError, setCastError] = useState<string | null>(null);
  const [receiverMedia, setReceiverMedia] = useState<ReceiverMediaView | null>(null);
  const [streamMode, setStreamMode] = useState<StreamMode | null>(streamModeValue);
  const [loadError, setLoadError] = useState<string | null>(loadErrorValue);
  // Fresh snapshot for the (once-mounted) event handler closure.
  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  /** Start tracking `session`, wiping the previous session's watchdog state.
   *  A no-op when it is already the tracked one, so the 1s poll can call it
   *  every tick without resetting anything. */
  function adoptSession(session: CastSession | null): void {
    if (session === null && activeSession === null) return;
    if (isActiveSession(session)) return;
    activeSession = session;
    resetSessionState();
    setStreamMode(null);
    setLoadError(null);
    setReceiverMedia(null);
    setDeviceName(safeFriendlyName(session));
  }

  /** Stop tracking whatever session was active — an external disconnect, a
   *  failed start, or our own stop. Invalidates the tokens too, so a load
   *  still in flight for the dead session can't write over the next one. */
  function forgetSession(): void {
    attemptToken += 1;
    startInFlight = false;
    pendingStart = false;
    activeSession = null;
    resetSessionState();
    setStreamMode(null);
    setLoadError(null);
    setReceiverMedia(null);
  }

  /** Attempt- and session-guarded teardown shared by every failure path.
   *  When a specific session is named (a load failed) only that session may be
   *  ended: a late rejection from an old load must not kill the session that
   *  has since resumed or replaced it. */
  function teardownAttempt(context: CastContext, token: number, session?: CastSession): void {
    if (attemptToken !== token) return;
    const current = context.getCurrentSession();
    if (session && current && !(isActiveSession(session) && isActiveSession(current))) {
      return; // someone else owns the receiver now — leave it alone
    }
    pendingStart = false;
    if (current) {
      try {
        context.endCurrentSession(true);
      } catch {
        // Already ended — nothing to do.
      }
    }
    // Force the rail back to idle as insurance against a missing
    // NOT_CONNECTED transition.
    setState('idle');
  }

  /** Build the media descriptor and hand it to the receiver. The Default Media
   *  Receiver can't take per-track updates without a stream restart, so the
   *  metadata snapshot is taken here, once. */
  async function loadMediaForSession(
    session: CastSession,
    mode: StreamMode,
    token: number,
  ): Promise<void> {
    const cc = chromeCast();
    if (!cc) return;
    const track = nowPlayingRef.current?.nowPlaying ?? null;
    const station = nowPlayingRef.current?.dj?.station;

    const mediaInfo = new cc.media.MediaInfo(
      // Cache-bust the cast URL, mirroring usePlayer's local-playback trick:
      // the Default Media Receiver caches media by URL, and a stale entry from
      // an earlier broken load would otherwise satisfy the load from cache —
      // the receiver reports PLAYING, never fetches the origin, and plays
      // silence. A fresh ?t= forces a real fetch on every cast, and makes each
      // cast visible in the server logs (the no-fetch signature is the
      // receiver's silent failure mode).
      `${config.mp3StreamUrl}?t=${Date.now()}`,
      'audio/mpeg',
    );
    mediaInfo.streamType =
      mode === 'live' ? cc.media.StreamType.LIVE : cc.media.StreamType.BUFFERED;
    // Do not set MediaInfo.duration for the live mount. LIVE already tells the
    // receiver that this is an endless stream, and the native SUB/WAVE sender
    // leaves duration unset. Supplying -1 is accepted by some CAF versions but
    // is rejected as an invalid media parameter by others.
    const metadata = new cc.media.MusicTrackMediaMetadata();
    metadata.title = track?.title ?? station ?? 'SUB/WAVE';
    metadata.artist = track?.artist ?? station ?? 'Live';
    metadata.albumName = track?.album ?? station ?? '';
    if (track?.subsonic_id) {
      metadata.images = [new cc.media.Image(coverUrl(track.subsonic_id))];
    }
    mediaInfo.metadata = metadata;

    const request = new cc.media.LoadRequest(mediaInfo);
    // Explicitly autoplay, but leave the position unset. For a LIVE media
    // request, `currentTime = 0` is not "start at the live edge": some CAF
    // receivers interpret it as a seek request and reject/stall a never-ending
    // Icecast mount. The SDK's null default is the correct live-stream value.
    request.autoplay = true;
    request.currentTime = null;

    // loadMedia RESOLVES with an error code on failure — it does not reject —
    // so the result must be checked or a failed load would be silent.
    const result = await session.loadMedia(request);
    // Guarded on the token *and* the session: an old session's slow load
    // resolving late must not relabel the session that replaced it.
    if (attemptToken !== token || !isActiveSession(session)) return;
    if (result) {
      console.warn(`[cast] receiver rejected the ${mode} stream load:`, result);
      throw new Error(`loadMedia failed: ${result}`);
    }
    console.info(`[cast] ${mode} stream load accepted by receiver`);
    loadedAt = Date.now();
    loadedMode = mode;
    sawPlaying = false;
    watchdogDisarmed = false;
    streamModeValue = mode;
    loadErrorValue = null;
    setStreamMode(mode);
    setLoadError(null);
  }

  // Both the once-mounted event handlers and the polling effect need to
  // trigger a load; keep a fresh reference so neither is stuck with a
  // first-render closure.
  const loadRef = useRef(loadMediaForSession);
  loadRef.current = loadMediaForSession;

  /** The single place a pending start turns into a load. Four signals can be
   *  the first to hold a usable session — requestSession() resolving, the
   *  CONNECTED cast-state event, SESSION_STARTED/RESUMED, and the 1s poll as a
   *  backstop — and any of them can arrive while getCurrentSession() is still
   *  null. Each one calls this; the flag makes exactly one of them win, and
   *  the poll guarantees the flag can never stay stuck set with a live
   *  session in hand. */
  function consumePendingStart(context: CastContext, session: CastSession): void {
    if (!pendingStart || pendingStartAttempt !== attemptToken) return;
    const token = attemptToken;
    pendingStart = false;
    adoptSession(session);
    void loadRef.current(session, 'live', token).catch(() => {
      teardownAttempt(context, token, session);
    });
  }

  // Same reason as loadRef: the once-mounted event handlers and the polling
  // effect both consume the pending start, and neither may be stuck with a
  // first-render closure.
  const consumeRef = useRef(consumePendingStart);
  consumeRef.current = consumePendingStart;

  useEffect(() => {
    let disposed = false;
    let removeListeners: (() => void) | null = null;

    void waitForCastApi()
      .then((available) => {
        if (disposed || !available) return; // unsupported browser / blocked SDK
        const framework = window.cast?.framework;
        const cc = chromeCast();
        if (!framework || !cc) return;

        try {
          // setOptions is a one-time call — StrictMode double-runs this effect,
          // so it is guarded with a module flag set only on success (if
          // getInstance/setOptions throw, a later retry is still possible and
          // the hook simply stays 'unavailable' instead of poisoning itself).
          if (!contextInitAttempted) {
            const ctx = framework.CastContext.getInstance();
            ctx.setOptions({
              receiverApplicationId: DEFAULT_RECEIVER_APP_ID,
              autoJoinPolicy: cc.AutoJoinPolicy.ORIGIN_SCOPED,
            });
            contextInitAttempted = true;
          }

          const context = framework.CastContext.getInstance();

          const syncFromCastState = (castState: string) => {
            if (castState === framework.CastState.CONNECTED) {
              setState('connected');
              const session = context.getCurrentSession();
              if (session) {
                setDeviceName(safeFriendlyName(session));
                // A session is attached and readable. If this is the connection
                // fulfilling a user-initiated cast, hand it the stream now.
                adoptSession(session);
                consumeRef.current(context, session);
              }
            } else if (castState === framework.CastState.CONNECTING) {
              setState('connecting');
            } else if (castState === framework.CastState.NOT_CONNECTED) {
              setState('idle');
            } else {
              setState('unavailable'); // NO_DEVICES_AVAILABLE (or unknown)
            }
          };

          const onCastStateChanged = (e: CastEvent) => {
            syncFromCastState(e.castState);
          };

          // Session lifecycle is the authoritative signal for *which* session
          // the bookkeeping describes. CAST_STATE_CHANGED only says "something
          // is connected"; this says which object, and it carries the session
          // even when getCurrentSession() has not caught up yet.
          const onSessionStateChanged = (e: CastSessionEvent) => {
            const { SessionState } = framework;
            if (
              e.sessionState === SessionState.SESSION_STARTED ||
              e.sessionState === SessionState.SESSION_RESUMED
            ) {
              const session = e.session ?? context.getCurrentSession();
              if (!session) return;
              adoptSession(session);
              setDeviceName(safeFriendlyName(session));
              consumeRef.current(context, session);
            } else if (
              e.sessionState === SessionState.SESSION_ENDED ||
              e.sessionState === SessionState.SESSION_START_FAILED
            ) {
              // External disconnect, receiver app quit, or a start that never
              // made it: invalidate the tokens as well, or an in-flight load
              // could land on whatever session comes next.
              forgetSession();
              setDeviceName(null);
            }
          };

          context.addEventListener(
            framework.CastContextEventType.CAST_STATE_CHANGED,
            onCastStateChanged,
          );
          context.addEventListener(
            framework.CastContextEventType.SESSION_STATE_CHANGED,
            onSessionStateChanged,
          );
          removeListeners = () => {
            context.removeEventListener(
              framework.CastContextEventType.CAST_STATE_CHANGED,
              onCastStateChanged,
            );
            context.removeEventListener(
              framework.CastContextEventType.SESSION_STATE_CHANGED,
              onSessionStateChanged,
            );
          };

          // Seed from the current state — an auto-joined session (page reload
          // while casting) must not wait for a transition event to appear.
          syncFromCastState(context.getCastState());
        } catch {
          // Cast unusable on this page (SDK in a bad state). Leave the hook
          // 'unavailable' — the button stays hidden; nothing to clean up.
        }
      })
      .catch(() => {
        // waitForCastApi never rejects by construction, but never leave an
        // unhandled rejection either way.
      });

    return () => {
      disposed = true;
      removeListeners?.();
    };
  }, []);

  // While a session is active, poll the receiver's media state once a second.
  // This is the ground truth for "connected but silent": IDLE means the load
  // was accepted but the receiver isn't playing it; BUFFERING forever means
  // its fetch of the stream URL is stalling. PLAYING is ambiguous on this
  // firmware — audio may already be audible while the clock still reads 0,
  // or the receiver may genuinely be dead — so a moving clock is the
  // confirmation signal, and the watchdog below outlasts the measured lag
  // before retrying in the other mode.
  useEffect(() => {
    if (state !== 'connected') {
      setReceiverState('unknown');
      setReceiverMedia(null);
      setReceiverPosition(null);
      setStreamMode(null);
      setLoadError(null);
      return;
    }
    const framework = window.cast?.framework;
    if (!framework) return;
    const context = framework.CastContext.getInstance();
    const poll = () => {
      const session = context.getCurrentSession();
      if (!session) {
        setReceiverState('unknown');
        setReceiverMedia(null);
        return;
      }
      // A session we never saw start (auto-join after a page reload, or one
      // that replaced ours) becomes the tracked one — with a clean watchdog,
      // because we did not load its media.
      adoptSession(session);
      // Backstop for the pending flag. Every event-driven consumer can fire
      // while getCurrentSession() is still null; this one runs with a session
      // in hand by definition, so the flag can never stay stuck set.
      consumeRef.current(context, session);

      const media = session.getMediaSession();
      const ps = media?.playerState;
      const idleReason = media?.idleReason ?? undefined;
      // The receiver's playback clock. On this firmware it lags real decode
      // by minutes (frozen ≠ silent, moving = confirmed), so it is a
      // confirmation signal, not an audibility test.
      setReceiverPosition(
        typeof media?.currentTime === 'number' ? media.currentTime : null,
      );
      // Receiver's own view of the loaded media: the duration it derived from
      // the HTTP response and the position it believes it is at. A finite
      // positive duration means the fake Content-Range total leaked through and
      // the receiver built a seekable window (the rail surfaces this);
      // absent/endless is the healthy shape.
      const m = media?.media;
      const mDuration = m?.duration;
      if (
        m &&
        typeof m.contentId === 'string' &&
        typeof mDuration === 'number' &&
        Number.isFinite(mDuration) &&
        mDuration > 0
      ) {
        setReceiverMedia({
          duration: mDuration,
          currentTime: media?.currentTime ?? null,
          contentId: m.contentId,
        });
      } else {
        setReceiverMedia(null);
      }
      const position = typeof media?.currentTime === 'number' ? media.currentTime : null;
      // PLAYING with a frozen zero clock is ambiguous on this firmware —
      // measured audible audio while the clock still read 0 — so a moving
      // clock is treated as confirmation of decoding, while a frozen one is
      // not treated as failure (the watchdog's 10-minute window handles the
      // truly dead receiver).
      if (ps === 'PLAYING' && position !== null && position > 0) sawPlaying = true;
      // A receiver that is paused or was stopped on the device has the media
      // and is deliberately not playing it. Disarm permanently: the elapsed
      // clock below would otherwise fire the moment it is unpaused.
      if (ps === 'PAUSED' || idleReason === 'CANCELLED') watchdogDisarmed = true;

      // Silent-receiver watchdog. A load the receiver accepted but never
      // starts playing raises no error and never tears the session down, so
      // nothing else would ever notice. Reload once in the other stream mode;
      // token- and session-guarded, and spent at most once per session.
      const delay = fallbackDelayFor(ps, idleReason, position);
      if (
        !sawPlaying &&
        !watchdogDisarmed &&
        !fallbackUsed &&
        loadedAt > 0 &&
        delay !== null &&
        Date.now() - loadedAt > delay &&
        isActiveSession(session)
      ) {
        fallbackUsed = true;
        const waited = Math.round((Date.now() - loadedAt) / 1000);
        const next: StreamMode = loadedMode === 'buffered' ? 'live' : 'buffered';
        console.warn(
          `[cast] receiver never started in ${loadedMode} mode after ${waited}s ` +
            `(playerState=${ps ?? 'none'}, idleReason=${idleReason ?? 'none'}); retrying as ${next}`,
        );
        // Report the fallback when it is *dispatched*, not when it resolves:
        // if the reload hangs or fails, the rail must not keep presenting the
        // mode that already demonstrably didn't play as the current one.
        streamModeValue = next;
        loadErrorValue = null;
        setStreamMode(next);
        setLoadError(null);
        const token = attemptToken;
        void loadRef.current(session, next, token).catch((err: unknown) => {
          // Leave the session up rather than tearing it down on the fallback:
          // the rail already reports the receiver state, which is the useful
          // signal here — but say out loud that the retry failed.
          if (attemptToken !== token || !isActiveSession(session)) return;
          console.warn(`[cast] ${next} fallback load failed:`, err);
          loadErrorValue = `${next} retry failed`;
          setLoadError(loadErrorValue);
        });
      }

      setReceiverState(classifyReceiver(ps, idleReason));
      // Mirror the shared view state: the load may have been driven by another
      // mounted instance of this hook.
      setStreamMode(streamModeValue);
      setLoadError(loadErrorValue);
    };
    poll();
    const timer = window.setInterval(poll, 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  async function startCast(): Promise<void> {
    const framework = window.cast?.framework;
    const cc = chromeCast();
    if (!framework || !cc) return;
    if (state === 'connecting' || state === 'connected') return;
    if (startInFlight) return;
    const context = framework.CastContext.getInstance();

    startInFlight = true;
    setCastError(null);
    const token = ++attemptToken;
    pendingStartAttempt = token;
    pendingStart = true;
    // Fresh session state for this attempt.
    activeSession = null;
    resetSessionState();
    setStreamMode(null);
    setLoadError(null);
    try {
      // requestSession opens the picker and settles when the user picks a
      // device (or dismisses it). A hung picker must never leave the hook
      // stuck in 'connecting' — every later tap would silently no-op — so
      // race it against a 45s guard and recover to idle.
      const rs = context.requestSession();
      // requestSession() can settle before CAF has attached the session to
      // CastContext. A plain Promise.race followed by getCurrentSession() made
      // that timing window look like a timeout, then ended the valid session
      // before SESSION_STARTED/CONNECTED could consume pendingStart.
      const timeout = Symbol('cast-session-timeout');
      const guard = new Promise<typeof timeout>((resolve) => {
        window.setTimeout(() => resolve(timeout), 45000);
      });
      const outcome = await Promise.race([rs, guard]);
      if (attemptToken !== token) return; // stop/start/disconnect superseded us
      if (outcome === timeout) {
        setCastError('Cast picker timed out — tap the cast button to retry');
        teardownAttempt(context, token);
        return;
      }
      const session = context.getCurrentSession();
      if (session) {
        // Usually the session is available here. If CAF attaches it a little
        // later, the pending flag remains set and the lifecycle event or the
        // polling backstop will load the media when the session appears.
        consumePendingStart(context, session);
      }
      // Do not tear down when requestSession() won but the session is not
      // attached yet. That is a real CAF timing window, not a timeout.
    } catch (err) {
      // Dismissing the picker rejects — that is a success-no-op, not an
      // error. Anything else is a real failure and must be visible.
      const code = (err as { code?: string | number } | null)?.code ?? '';
      if (!['cancel', 'CANCEL', 'cancel_requested', 'CANCELED'].includes(String(code))) {
        console.warn('[cast] requestSession failed:', err);
        setCastError('Cast picker failed — tap the cast button to retry');
      }
      teardownAttempt(context, token);
    } finally {
      // Release the in-flight guard only, and only if this attempt is still
      // the live one (a newer start owns the guard otherwise).
      if (attemptToken === token) {
        startInFlight = false;
      }
    }
  }

  async function stopCast(): Promise<void> {
    const framework = window.cast?.framework;
    if (!framework) return;
    const context = framework.CastContext.getInstance();
    // Invalidate any in-flight start; the teardown below then can't be
    // confused with a session a newer attempt is establishing.
    forgetSession();
    if (context.getCurrentSession()) {
      context.endCurrentSession(true);
      // State returns to 'idle' via CAST_STATE_CHANGED when teardown completes
      // — no optimistic setState, so the UI never lies about a session that is
      // still winding down.
    }
  }

  return {
    state,
    deviceName,
    receiverState,
    receiverPosition,
    castError,
    receiverMedia,
    streamMode,
    loadError,
    supported: state !== 'unavailable',
    cast: startCast,
    stop: stopCast,
  };
}
