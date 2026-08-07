// Wires the OS Media Session — lock-screen / headphone / CarPlay now-playing
// metadata and artwork — to the live track. Skip/seek are intentionally NOT
// wired: this is a shared live stream, so a stray headphone double-tap must not
// try to skip. Only play/pause are meaningful.
//
// No-ops gracefully where the API is absent (older/desktop browsers).

import { useEffect } from 'react';
import { coverUrl } from '@/lib/stationClient';
import type { NowPlayingTrack } from '@/lib/types';

export function useMediaSession(
  track: NowPlayingTrack | null | undefined,
  station: string | undefined,
  playing: boolean,
  handlers: { onPlay: () => void; onPause: () => void },
) {
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || !track) return;

    ms.metadata = new MediaMetadata({
      title: track.title || 'Live',
      artist: track.artist || station || 'SUB/WAVE',
      album: track.album || station || '',
      artwork: track.subsonic_id
        ? [
            { src: coverUrl(track.subsonic_id), sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    });

    try {
      ms.setActionHandler('play', handlers.onPlay);
      ms.setActionHandler('pause', handlers.onPause);
      // Explicitly disable transport we don't support on live radio.
      ms.setActionHandler('previoustrack', null);
      ms.setActionHandler('nexttrack', null);
      ms.setActionHandler('seekto', null);
    } catch {
      // Some handlers unsupported on some browsers — ignore.
    }
  }, [track, station, handlers]);

  useEffect(() => {
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }, [playing]);
}
