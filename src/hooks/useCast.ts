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

import { useEffect, useRef, useState } from 'react';
import { config } from '@/config';
import { coverUrl } from '@/lib/stationClient';
import { useStationFeed } from '@/hooks/useStationFeed';

export type CastState = 'unavailable' | 'idle' | 'connecting' | 'connected';

/** What the receiver reports about the loaded stream, polled while connected.
 *  'unknown' before the first status arrives (or while not casting). */
export type ReceiverState = 'unknown' | 'idle' | 'buffering' | 'playing' | 'paused' | 'ended';

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
  async function loadMediaForSession(session: CastSession): Promise<void> {
    const cc = chromeCast();
    if (!cc) return;
    const track = nowPlayingRef.current?.nowPlaying ?? null;
    const station = nowPlayingRef.current?.dj?.station;

    const mediaInfo = new cc.media.MediaInfo(config.mp3StreamUrl, 'audio/mpeg');
    mediaInfo.streamType = cc.media.StreamType.LIVE;
    const metadata = new cc.media.MusicTrackMediaMetadata();
    metadata.title = track?.title ?? station ?? 'SUB/WAVE';
    metadata.artist = track?.artist ?? station ?? 'Live';
    metadata.albumName = track?.album ?? station ?? '';
    if (track?.subsonic_id) {
      metadata.images = [new cc.media.Image(coverUrl(track.subsonic_id))];
    }
    mediaInfo.metadata = metadata;

    // loadMedia RESOLVES with an error code on failure — it does not reject —
    // so the result must be checked or a failed load would be silent.
    const result = await session.loadMedia(new cc.media.LoadRequest(mediaInfo));
    if (result) {
      console.warn('[cast] receiver rejected the stream load:', result);
      throw new Error(`loadMedia failed: ${result}`);
    }
    console.info('[cast] stream load accepted by receiver');
  }

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
                pendingStartRef.current = false;
                const session = context.getCurrentSession();
                if (session) {
                  void loadMediaForSession(session).catch(() => {
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
      return;
    }
    const framework = window.cast?.framework;
    if (!framework) return;
    const context = framework.CastContext.getInstance();
    const poll = () => {
      const media = context.getCurrentSession()?.getMediaSession();
      const ps = media?.playerState;
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
          await loadMediaForSession(session);
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
    supported: state !== 'unavailable',
    cast: startCast,
    stop: stopCast,
  };
}
