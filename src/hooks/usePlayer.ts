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

export interface Player {
  /** Whether audio is currently playing. */
  playing: boolean;
  /** True after the first successful tune-in — i.e. the gesture gate is passed. */
  tunedIn: boolean;
  /** True while the browser is buffering the stream after a play(). */
  loading: boolean;
  volume: number;
  muted: boolean;
  /** Begin playback. Safe to call from a click handler. */
  tuneIn: () => void;
  /** Play if paused, pause if playing. */
  toggle: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
}

export function usePlayer(): Player {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tunedIn, setTunedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volume, setVolumeState] = useState(0.85);
  const [muted, setMuted] = useState(false);

  // Create the element once. It lives for the app's lifetime.
  useEffect(() => {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'none';
    el.volume = volume;
    audioRef.current = el;

    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onError = () => {
      setPlaying(false);
      setLoading(false);
    };
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('stalled', onWaiting);
    el.addEventListener('error', onError);

    return () => {
      el.pause();
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('stalled', onWaiting);
      el.removeEventListener('error', onError);
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
    const el = audioRef.current;
    if (!el) return;
    // Re-point at the live edge every time we start: a paused live stream goes
    // stale, so we reload rather than resume from a buffered position.
    el.src = `${config.streamUrl}?t=${Date.now()}`;
    setLoading(true);
    el.play()
      .then(() => {
        setTunedIn(true);
      })
      .catch(() => {
        // Autoplay blocked or network error — surface as "not playing".
        setLoading(false);
        setPlaying(false);
      });
  }

  function stop() {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.src = '';
    setPlaying(false);
    setLoading(false);
  }

  return {
    playing,
    tunedIn,
    loading,
    volume,
    muted,
    tuneIn: play,
    toggle: () => (playing ? stop() : play()),
    setVolume: (v: number) => setVolumeState(Math.min(1, Math.max(0, v))),
    toggleMute: () => setMuted((m) => !m),
  };
}
