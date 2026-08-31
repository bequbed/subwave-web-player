// Composition root. The layout lives here; every piece of data comes from the
// hooks. Redesigning the player is mostly a matter of rearranging these
// components and restyling them — the data layer underneath doesn't change.
//
// LONGWAVE dissolves the bento into an editorial single spine: masthead, hero,
// player rail, a two-column body, then the schedule full width.

import { StationFeedProvider, useStationFeed } from '@/hooks/useStationFeed';
import { usePlayer } from '@/hooks/usePlayer';
import { useCast } from '@/hooks/useCast';
import { useMediaSession } from '@/hooks/useMediaSession';
import { config } from '@/config';
import { listenerCount } from '@/lib/format';
import { NowPlaying } from '@/components/NowPlaying';
import { PlayerBar } from '@/components/PlayerBar';
import { OnAir } from '@/components/OnAir';
import { Queue } from '@/components/Queue';
import { RequestBox } from '@/components/RequestBox';
import { Schedule } from '@/components/Schedule';
import { SignalDot } from '@/components/ui/SignalDot';

function stationHost() {
  try {
    return new URL(config.stationUrl).host;
  } catch {
    return config.stationUrl;
  }
}

function Masthead() {
  const { online, ready, nowPlaying } = useStationFeed();
  const station = nowPlaying?.dj?.station || 'SUB/WAVE';
  const listeners = listenerCount(nowPlaying?.listeners);

  return (
    <header className="mb-8 border-b border-[var(--rule)] pb-5 sm:mb-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="type-display truncate text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--graphite)] sm:text-3xl">
            {station}
          </h1>
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-[var(--pencil)]">
            {stationHost()}
          </p>
        </div>

        <div className="flex min-w-0 max-w-full flex-col gap-4 sm:items-end">
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-5">
            {listeners != null && (
              <span className="shrink-0 text-[11px] uppercase tabular-nums tracking-[0.16em] text-[var(--pencil)]">
                {listeners} listening
              </span>
            )}
            <SignalDot online={online} ready={ready} />
          </div>
          {/* On desktop the on-air host reads as the masthead byline. It has to
              hold any guest count inside the page width, so it stays full-width
              here and wraps internally rather than pushing the layout wider. */}
          <aside aria-label="On air host" className="w-full min-w-0 max-w-full">
            <OnAir />
          </aside>
        </div>
      </div>
    </header>
  );
}

function PlayerView() {
  const player = usePlayer();
  const cast = useCast();
  const { nowPlaying } = useStationFeed();
  const track = nowPlaying?.nowPlaying ?? null;

  useMediaSession(track, nowPlaying?.dj?.station, player.playing, {
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

  return (
    // The bottom padding below `lg` is layout compensation for the player rail,
    // which is fixed to the viewport there (see PlayerBar) so Tune In stays
    // reachable at any scroll position. At `lg` the rail rejoins the flow.
    <div className="mx-auto w-full max-w-6xl px-6 pt-8 pb-36 sm:px-10 sm:pt-10 lg:pb-10">
      <Masthead />

      <main className="space-y-10">
        <section aria-label="Now playing" className="space-y-6">
          <NowPlaying playing={player.playing} />
          <PlayerBar player={player} />
        </section>

        {/* Request | Queue: the interactive pair. The Booth's raw DJ decision
            log was removed — it leaked LLM prompts and internal ids, and
            nobody read it. The freed width goes to these two, now peers. */}
        <section
          aria-label="Requests and queue"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8"
        >
          <aside aria-label="Request a track" className="min-w-0">
            <RequestBox />
          </aside>
          <aside aria-label="On the Deck" className="min-w-0">
            <Queue />
          </aside>
        </section>

        <section aria-label="Weekly schedule">
          <Schedule />
        </section>
      </main>

      <footer className="mt-10 flex flex-col gap-2 border-t border-[var(--rule)] pt-5 text-[11px] leading-[1.55] text-[var(--pencil)] sm:flex-row sm:items-center sm:justify-between">
        <span>
          A reference SUB/WAVE web player · point it at any station with{' '}
          <code className="rounded-[2px] bg-[var(--leaf-raised)] px-1 py-0.5">VITE_STATION_URL</code>
        </span>
        <a
          href="https://github.com/perminder-klair/subwave"
          className="w-fit rounded-[2px] underline decoration-[var(--rule)] underline-offset-4 transition-colors hover:text-[var(--ember)] hover:decoration-[var(--ember)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ember)]"
          target="_blank"
          rel="noreferrer"
        >
          about SUB/WAVE ↗
        </a>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StationFeedProvider>
      <PlayerView />
    </StationFeedProvider>
  );
}
