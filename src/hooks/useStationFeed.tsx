// The single live-data heartbeat. One interval polls /now-playing, /state and
// /session together and shares the result through context, so every component
// reads the same snapshot instead of each opening its own poll loop.
//
// Behaviour that matters:
//  - Polls every config.pollIntervalMs, immediately on mount.
//  - Pauses while the tab is hidden (a backgrounded tab shouldn't poll) and
//    refetches the moment it becomes visible again.
//  - On a failed fetch it keeps the last good snapshot and flips `online`
//    false — the UI degrades to "reconnecting", never blanks.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { config } from '@/config';
import { fetchNowPlaying, fetchSession, fetchState } from '@/lib/stationClient';
import type { NowPlayingResponse, SessionPayload, StationState } from '@/lib/types';

export interface StationFeed {
  nowPlaying: NowPlayingResponse | null;
  state: StationState | null;
  session: SessionPayload | null;
  /** True once at least one poll has completed. */
  ready: boolean;
  /** True while the most recent poll succeeded. */
  online: boolean;
}

const EMPTY: StationFeed = {
  nowPlaying: null,
  state: null,
  session: null,
  ready: false,
  online: false,
};

const FeedContext = createContext<StationFeed>(EMPTY);

export function StationFeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<StationFeed>(EMPTY);
  // Keep the latest snapshot in a ref so a failed poll can preserve it without
  // adding `feed` to the effect deps (which would restart the interval).
  const latest = useRef<StationFeed>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function poll() {
      try {
        const [nowPlaying, state, session] = await Promise.all([
          fetchNowPlaying(),
          fetchState(),
          fetchSession(),
        ]);
        if (cancelled) return;
        const next: StationFeed = { nowPlaying, state, session, ready: true, online: true };
        latest.current = next;
        setFeed(next);
      } catch {
        if (cancelled) return;
        const next = { ...latest.current, ready: true, online: false };
        latest.current = next;
        setFeed(next);
      }
    }

    function start() {
      poll();
      timer = setInterval(poll, config.pollIntervalMs);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <FeedContext.Provider value={feed}>{children}</FeedContext.Provider>;
}

/** Read the shared live station snapshot. */
export function useStationFeed(): StationFeed {
  return useContext(FeedContext);
}
