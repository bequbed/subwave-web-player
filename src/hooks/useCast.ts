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
// uses. BUFFERED + `currentTime = 0` is what makes the receiver read that way,
// and `duration = -1` stops it deriving a seekable window at all.

import { useEffect, useRef, useState } from 'react';
import { config } from '@/config';
import { coverUrl } from '@/lib/stationClient';
import { useStationFeed } from '@/hooks/useStationFeed';

export type CastState = 'unavailable' | 'idle' | 'connecting' | 'connected';

/** What the receiver reports about the loaded stream, polled while connected.
 *  'unknown' before the first status arrives (or while not casting). */
export type ReceiverState = 'unknown' | 'idle' | 'buffering' | 'playing' | 'paused' | 'ended';

/** How the stream was described to the receiver. 'buffered' is the correct
 *  mode for this Icecast mount (see the note above); 'live' only appears if
 *  the watchdog below had to fall back to it. */
export type StreamMode = 'buffered' | 'live';

/** If the receiver has not reached PLAYING this long after a load was
 *  accepted, reload once in the other stream mode. Covers the case where a
 *  receiver firmware behaves the opposite way round to the one diagnosed. */
const FALLBACK_AFTER_MS = 10000;

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

export interface Cast {
  /** 'unavailable' until the SDK loads and finds devices; 'connected' while a
   *  session is active on a speaker. */
  state: CastState;
  /** Friendly name of the receiving device while connected. */
  deviceName: string | null;
  /** Receiver-reported media state ('playing'/'buffering'/'idle'...), polled
   *  once a second while a session is active. */
  receiverState: ReceiverState;
  /** Which stream mode the receiver is currently loaded with, or null when
   *  nothing is loaded. 'live' means the BUFFERED attempt never started and
   *  the watchdog fell back — worth surfacing, it is diagnostic. */
  streamMode: StreamMode | null;
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
  const [streamMode, setStreamMode] = useState<StreamMode | null>(null);
  // Watchdog bookkeeping: when the last load was accepted, in which mode,
  // whether the receiver has ever actually played it, and whether the one
  // permitted fallback reload has been spent.
  const loadedAtRef = useRef(0);
  const loadedModeRef = useRef<StreamMode>('buffered');
  const sawPlayingRef = useRef(false);
  const fallbackUsedRef = useRef(false);
  // Monotonic operation tokens: invalidated on every stop/start so a stale
  // requestSession/loadMedia from an earlier attempt can never touch a session
  // it doesn't own (e.g. ending the session a newer attempt just started).
  const attemptRef = useRef(0);
  // Synchronous in-flight guard: the picker's CONNECTING state arrives via an
  // async event, so render state alone cannot stop a double-click opening two
  // pickers before that event lands.
  const startInFlightRef = useRef(false);
  // Set when the user asks to cast; cleared the moment loadMedia fires. The
  // CONNECTED event handler loads media on this flag, so a session whose
  // requestSession() promise resolves before/after the event still gets its
  // stream loaded exactly once.
  const pendingStartRef = useRef(false);
  const pendingStartAttemptRef = useRef(0);
  // Fresh snapshot for the (once-mounted) event handler closure.
  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  /** Attempt-guarded teardown shared by every failure path: only touches the
   *  session if this attempt is still the live one, and forces the rail back
   *  to idle as insurance against a missing NOT_CONNECTED transition. */
  function teardownAttempt(context: CastContext, attempt: number): void {
    if (attemptRef.current !== attempt) return;
    pendingStartRef.current = false;
    if (context.getCurrentSession()) {
      try {
        context.endCurrentSession(true);
      } catch {
        // Already ended — nothing to do.
      }
    }
    setState('idle');
  }

  /** Build the media descriptor and hand it to the receiver. The Default Media
   *  Receiver can't take per-track updates without a stream restart, so the
   *  metadata snapshot is taken here, once. */
  async function loadMediaForSession(
    session: CastSession,
    mode: StreamMode,
    attempt: number,
  ): Promise<void> {
    const cc = chromeCast();
    if (!cc) return;
    const track = nowPlayingRef.current?.nowPlaying ?? null;
    const station = nowPlayingRef.current?.dj?.station;

    const mediaInfo = new cc.media.MediaInfo(config.mp3StreamUrl, 'audio/mpeg');
    mediaInfo.streamType =
      mode === 'live' ? cc.media.StreamType.LIVE : cc.media.StreamType.BUFFERED;
    if (mode === 'live') {
      // -1 = endless, which is what Google documents for LIVE. Without it the
      // receiver derives a seekable window from Icecast's fabricated 1GiB
      // Content-Range and seeks into audio that does not exist. Left untouched
      // in BUFFERED mode on purpose: there the receiver reads open-ended, gets
      // a 200 with no Content-Length, and infers an endless stream by itself —
      // exactly how the local <audio> element already plays this mount.
      mediaInfo.duration = -1;
    }
    const metadata = new cc.media.MusicTrackMediaMetadata();
    metadata.title = track?.title ?? station ?? 'SUB/WAVE';
    metadata.artist = track?.artist ?? station ?? 'Live';
    metadata.albumName = track?.album ?? station ?? '';
    if (track?.subsonic_id) {
      metadata.images = [new cc.media.Image(coverUrl(track.subsonic_id))];
    }
    mediaInfo.metadata = metadata;

    const request = new cc.media.LoadRequest(mediaInfo);
    // Both already match the SDK constructor defaults (autoplay = true,
    // currentTime = null). They are set explicitly because they are the two
    // properties that decide whether the receiver starts, and where — pinning
    // currentTime to 0 keeps it on the open-ended read Icecast serves cleanly
    // rather than a seek into the fabricated range.
    request.autoplay = true;
    request.currentTime = 0;

    // loadMedia RESOLVES with an error code on failure — it does not reject —
    // so the result must be checked or a failed load would be silent.
    const result = await session.loadMedia(request);
    if (attemptRef.current !== attempt) return; // superseded while in flight
    if (result) {
      console.warn(`[cast] receiver rejected the ${mode} stream load:`, result);
      throw new Error(`loadMedia failed: ${result}`);
    }
    console.info(`[cast] ${mode} stream load accepted by receiver`);
    loadedAtRef.current = Date.now();
    loadedModeRef.current = mode;
    sawPlayingRef.current = false;
    setStreamMode(mode);
  }

  // Both the once-mounted CAST_STATE_CHANGED handler and the polling effect
  // need to trigger a load; keep a fresh reference so neither is stuck with a
  // first-render closure.
  const loadRef = useRef(loadMediaForSession);
  loadRef.current = loadMediaForSession;

  useEffect(() => {
    let disposed = false;
    let removeCastListener: (() => void) | null = null;

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
              setDeviceName(
                context.getCurrentSession()?.getSessionObj().receiver.friendlyName ?? null,
              );
              setState('connected');
              // A session just attached. If this is the connection fulfilling a
              // user-initiated cast, hand it the stream now — the requestSession
              // promise alone is not a reliable signal that the session object
              // is readable yet, but this event is.
              if (
                pendingStartRef.current &&
                pendingStartAttemptRef.current === attemptRef.current
              ) {
                const attempt = attemptRef.current;
                const session = context.getCurrentSession();
                // Consume the pending flag ONLY once a session is actually in
                // hand. Clearing it first meant that a CONNECTED event arriving
                // before the session object attached burned the flag and the
                // stream was never loaded at all — a permanently connected,
                // permanently silent session with no error anywhere.
                if (session) {
                  pendingStartRef.current = false;
                  void loadRef.current(session, 'buffered', attempt).catch(() => {
                    teardownAttempt(context, attempt);
                  });
                }
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

          context.addEventListener(
            framework.CastContextEventType.CAST_STATE_CHANGED,
            onCastStateChanged,
          );
          removeCastListener = () => {
            context.removeEventListener(
              framework.CastContextEventType.CAST_STATE_CHANGED,
              onCastStateChanged,
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
      removeCastListener?.();
    };
  }, []);

  // While a session is active, poll the receiver's media state once a second.
  // This is the ground truth for "connected but silent": IDLE means the load
  // was accepted but the receiver isn't playing it; BUFFERING forever means
  // its fetch of the stream URL is stalling; PLAYING means audio should be
  // audible (and any silence is device-side).
  useEffect(() => {
    if (state !== 'connected') {
      setReceiverState('unknown');
      setStreamMode(null);
      return;
    }
    const framework = window.cast?.framework;
    if (!framework) return;
    const context = framework.CastContext.getInstance();
    const poll = () => {
      const session = context.getCurrentSession();
      const media = session?.getMediaSession();
      const ps = media?.playerState;
      if (ps === 'PLAYING') sawPlayingRef.current = true;

      // Silent-receiver watchdog. A load the receiver accepted but never
      // starts playing raises no error and never tears the session down, so
      // nothing else would ever notice. Reload once in the other stream mode;
      // attempt-token guarded, and spent at most once per session.
      if (
        !sawPlayingRef.current &&
        !fallbackUsedRef.current &&
        loadedAtRef.current > 0 &&
        Date.now() - loadedAtRef.current > FALLBACK_AFTER_MS &&
        session
      ) {
        fallbackUsedRef.current = true;
        const next: StreamMode = loadedModeRef.current === 'buffered' ? 'live' : 'buffered';
        console.warn(
          `[cast] receiver never started in ${loadedModeRef.current} mode; retrying as ${next}`,
        );
        void loadRef.current(session, next, attemptRef.current).catch(() => {
          // Leave the session up rather than tearing it down on the fallback:
          // the rail already reports the receiver state, which is the useful
          // signal here.
        });
      }

      setReceiverState(
        ps === 'PLAYING'
          ? 'playing'
          : ps === 'BUFFERING'
            ? 'buffering'
            : ps === 'PAUSED'
              ? 'paused'
              : ps === 'IDLE'
                ? 'idle'
                : ps === 'ENDED'
                  ? 'ended'
                  : 'unknown',
      );
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
    if (startInFlightRef.current) return;
    const context = framework.CastContext.getInstance();

    startInFlightRef.current = true;
    const attempt = ++attemptRef.current;
    pendingStartAttemptRef.current = attempt;
    pendingStartRef.current = true;
    // Fresh watchdog state for this attempt.
    loadedAtRef.current = 0;
    loadedModeRef.current = 'buffered';
    sawPlayingRef.current = false;
    fallbackUsedRef.current = false;
    setStreamMode(null);
    try {
      // Opens the picker and resolves once the user picks a device (or the
      // picker is dismissed). It does NOT carry the session — the CONNECTED
      // event handler above loads media as soon as the session attaches; this
      // path is the fallback for when the session is already readable here.
      await context.requestSession();
      if (attemptRef.current !== attempt) return; // stop/start superseded us
      if (pendingStartRef.current) {
        const session = context.getCurrentSession();
        if (session) {
          // Session already attached — load immediately. (If it is not yet
          // readable here, leave the pending flag set: the CONNECTED event
          // will consume it the moment the session attaches.)
          pendingStartRef.current = false;
          await loadRef.current(session, 'buffered', attempt);
        }
      }
    } catch {
      teardownAttempt(context, attempt);
    } finally {
      // Release the in-flight guard only. pendingStartRef stays set if the
      // session had not attached yet — the CONNECTED event consumes it the
      // moment it does; teardownAttempt/stopCast/new starts clear it otherwise.
      if (attemptRef.current === attempt) {
        startInFlightRef.current = false;
      }
    }
  }

  async function stopCast(): Promise<void> {
    const framework = window.cast?.framework;
    if (!framework) return;
    const context = framework.CastContext.getInstance();
    // Invalidate any in-flight start; the teardown below then can't be
    // confused with a session a newer attempt is establishing.
    attemptRef.current += 1;
    startInFlightRef.current = false;
    pendingStartRef.current = false;
    loadedAtRef.current = 0;
    sawPlayingRef.current = false;
    fallbackUsedRef.current = false;
    setStreamMode(null);
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
    streamMode,
    supported: state !== 'unavailable',
    cast: startCast,
    stop: stopCast,
  };
}
