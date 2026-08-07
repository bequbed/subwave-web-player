// Composition root. The layout lives here; every piece of data comes from the
// hooks. Redesigning the player is mostly a matter of rearranging these
// components and restyling them — the data layer underneath doesn't change.

import { StationFeedProvider, useStationFeed } from '@/hooks/useStationFeed';
import { usePlayer } from '@/hooks/usePlayer';
import { useMediaSession } from '@/hooks/useMediaSession';
import { config } from '@/config';
import { NowPlaying } from '@/components/NowPlaying';
import { PlayerBar } from '@/components/PlayerBar';
import { OnAir } from '@/components/OnAir';
import { BoothFeed } from '@/components/BoothFeed';
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

function Header() {
  const { online, ready, nowPlaying } = useStationFeed();
  const station = nowPlaying?.dj?.station || 'SUB/WAVE';

  return (
    <header className="mb-6 border-b border-[var(--line)] pb-4 sm:mb-8 sm:pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-sm font-black text-[var(--signal)] shadow-[0_0_24px_color-mix(in_srgb,var(--signal)_12%,transparent)]"
          >
            ◉
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight tracking-[-0.02em] sm:text-lg">
              {station}
            </h1>
            <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              {stationHost()}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-4 sm:justify-end">
          <aside aria-label="On air host" className="min-w-0">
            <OnAir />
          </aside>
          <SignalDot online={online} ready={ready} />
        </div>
      </div>
    </header>
  );
}

function PlayerView() {
  const player = usePlayer();
  const { nowPlaying } = useStationFeed();
  const track = nowPlaying?.nowPlaying ?? null;

  useMediaSession(track, nowPlaying?.dj?.station, player.playing, {
    onPlay: player.tuneIn,
    onPause: player.toggle,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <Header />

      <main className="space-y-5 sm:space-y-6">
        <section aria-label="Now playing" className="space-y-3">
          <NowPlaying playing={player.playing} />
          <PlayerBar player={player} />
        </section>

        <section
          aria-label="Station activity"
          className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5"
        >
          <section aria-label="The Booth" className="h-[26rem] lg:col-span-8 lg:h-[28rem]">
            <BoothFeed />
          </section>
          <aside aria-label="Request a track" className="h-[22rem] lg:col-span-4 lg:h-[28rem]">
            <RequestBox />
          </aside>
          <aside aria-label="On the Deck" className="h-[24rem] lg:col-span-4 lg:h-[25rem]">
            <Queue />
          </aside>
          <section
            aria-label="Weekly schedule"
            className="h-[24rem] lg:col-span-8 lg:h-[25rem]"
          >
            <Schedule />
          </section>
        </section>
      </main>

      <footer className="mt-8 flex flex-col gap-2 border-t border-[var(--line)] pt-4 text-[11px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>
          A reference SUB/WAVE web player · point it at any station with{' '}
          <code className="rounded bg-[var(--panel-2)] px-1 py-0.5">VITE_STATION_URL</code>
        </span>
        <a
          href="https://github.com/perminder-klair/subwave"
          className="w-fit rounded-sm transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--signal)]"
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
