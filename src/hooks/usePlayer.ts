// Owns the single <audio> element and the playback state around it.
//
// SUB/WAVE is *live radio* — one shared Icecast stream, no seeking, no skip.
// So this hook is deliberately simple: tune in (play), toggle, mute, volume.
// Browsers block autoplay with sound, so playback can only begin on a real user
// gesture — `tuneIn()` is meant to be called from a click/tap. `crossOrigin`
// is 'anonymous' so the stream can later feed a Web Audio visualiser if you add
// one (the Icecast mount sends `Access-Control-Allow-Origin: *`).

import { useEffect, useRef, useState } from 'react';
import { config } from '@/config';

type StreamQuality = 'flac' | 'mp3';

function canPlayFlac(el: HTMLAudioElement): boolean {
  return ['audio/flac', 'audio/ogg; codecs="flac"'].some(
    (type) => el.canPlayType(type) === 'probably' || el.canPlayType(type) === 'maybe',
  );
}

export interface Player {
  /** Whether audio is currently playing. */
  playing: boolean;
  /** True after the first successful tune-in — i.e. the gesture gate is passed. */
  tunedIn: boolean;
  /** True while the browser is buffering the stream after a play(). */
  loading: boolean;
  /** Format currently selected for the live stream. */
  quality: StreamQuality | null;
  volume: number;
  muted: boolean;
  /** Begin playback. Safe to call from a click handler. */
  tuneIn: () => void;
  /** Play if paused, pause if playing. */
  toggle: () => void;
  /** Stop local playback and drop the source (used to hand off to a cast
   *  session so phone and speaker never play the same stream twice). */
  stop: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
}

export function usePlayer(): Player {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tunedIn, setTunedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quality, setQuality] = useState<StreamQuality | null>(null);
  const [volume, setVolumeState] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const qualityRef = useRef<StreamQuality | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const sourceAttemptRef = useRef(0);
  const assignedSourceRef = useRef<string | null>(null);

  // Create the element once. It lives for the app's lifetime.
  useEffect(() => {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'none';
    el.volume = volume;
    audioRef.current = el;

    const onPlaying = () => {
      playbackStartedRef.current = true;
      setTunedIn(true);
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onError = () => {
      // Media error events carry no attempt token. The src/currentSrc IDL values
      // are browser-normalized absolute URLs, so only handle the event while
      // currentSrc still identifies the exact uniquely-tagged URL we assigned.
      // A queued error from a replaced resource therefore cannot mutate the new
      // attempt, while an active FLAC error still reaches the one MP3 fallback.
      if (!assignedSourceRef.current || el.currentSrc !== assignedSourceRef.current) return;

      if (
        qualityRef.current === 'flac' &&
        !playbackStartedRef.current &&
        !fallbackAttemptedRef.current
      ) {
        fallbackAttemptedRef.current = true;
        const fallbackAttempt = ++sourceAttemptRef.current;
        qualityRef.current = 'mp3';
        el.src = `${config.mp3StreamUrl}?t=${Date.now()}&attempt=${fallbackAttempt}`;
        assignedSourceRef.current = el.src;
        setQuality('mp3');
        void el.play().catch(() => {
          if (sourceAttemptRef.current !== fallbackAttempt) return;
          setPlaying(false);
          setLoading(false);
        });
        return;
      }
      setPlaying(false);
      setLoading(false);
    };
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('stalled', onWaiting);
    el.addEventListener('error', onError);

    return () => {
      sourceAttemptRef.current += 1;
      el.pause();
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('stalled', onWaiting);
      el.removeEventListener('error', onError);
      assignedSourceRef.current = null;
      el.src = '';
      audioRef.current = null;
    };
    // Intentionally run once — volume is applied via its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = muted ? 0 : volume;
  }, [volume, muted]);

  function play() {
    const sourceAttempt = ++sourceAttemptRef.current;
    const el = audioRef.current;
    if (!el) return;
    fallbackAttemptedRef.current = false;
    playbackStartedRef.current = false;
    const selectedQuality: StreamQuality = canPlayFlac(el) ? 'flac' : 'mp3';
    qualityRef.current = selectedQuality;
    // Re-point at the live edge every time we start: a paused live stream goes
    // stale, so we reload rather than resume from a buffered position.
    const streamUrl =
      selectedQuality === 'flac' ? config.flacStreamUrl : config.mp3StreamUrl;
    el.src = `${streamUrl}?t=${Date.now()}&attempt=${sourceAttempt}`;
    assignedSourceRef.current = el.src;
    setQuality(selectedQuality);
    setLoading(true);
    void el.play().catch(() => {
      if (sourceAttemptRef.current !== sourceAttempt) return;
      // Autoplay blocked or network error — surface as "not playing".
      setLoading(false);
      setPlaying(false);
    });
  }

  function stop() {
    sourceAttemptRef.current += 1;
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    assignedSourceRef.current = null;
    el.src = '';
    qualityRef.current = null;
    playbackStartedRef.current = false;
    setPlaying(false);
    setLoading(false);
    setQuality(null);
  }

  return {
    playing,
    tunedIn,
    loading,
    quality,
    volume,
    muted,
    tuneIn: play,
    toggle: () => (playing ? stop() : play()),
    stop,
    setVolume: (v: number) => setVolumeState(Math.min(1, Math.max(0, v))),
    toggleMute: () => setMuted((m) => !m),
  };
}
