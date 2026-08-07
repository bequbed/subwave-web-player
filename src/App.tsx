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
    <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-lg font-black text-black">
          ◉
        </div>
        <div>
          <h1 className="text-lg font-bold leading-none tracking-tight">{station}</h1>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">{stationHost()}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <OnAir />
        <SignalDot online={online} ready={ready} />
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Header />

      <div className="space-y-4">
        <NowPlaying playing={player.playing} />
        <PlayerBar player={player} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-[400px] lg:col-span-2">
            <BoothFeed />
          </div>
          <div className="h-[400px]">
            <RequestBox />
          </div>
          <div className="h-[380px]">
            <Queue />
          </div>
          <div className="h-[380px] lg:col-span-2">
            <Schedule />
          </div>
        </div>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
        <span>
          A reference SUB/WAVE web player · point it at any station with{' '}
          <code className="rounded bg-[var(--panel-2)] px-1 py-0.5">VITE_STATION_URL</code>
        </span>
        <a
          href="https://github.com/perminder-klair/subwave"
          className="hover:text-[var(--accent)]"
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
