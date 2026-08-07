// A client-side track clock. The controller doesn't stream a live playhead, so
// we approximate: whenever the airing track changes (keyed by subsonic_id), we
// reset to zero and tick up one second at a time. It re-syncs on every track
// change, which for a crossfaded radio stream is close enough for a progress
// bar and an "up next in…" tease.
//
// Only ticks while `active` is true (pass the player's `playing`) so a paused
// player doesn't run the bar off the end.

import { useEffect, useRef, useState } from 'react';

export function useElapsed(trackKey: string | undefined, active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  // Reset the origin whenever the track changes.
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [trackKey]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active, trackKey]);

  return elapsed;
}
