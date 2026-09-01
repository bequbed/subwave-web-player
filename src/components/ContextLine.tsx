// The masthead dateline: one mono-caps echo of the station's own sense of
// "now" — day-period, vibe, weather — the same line the SubWave app shows
// ("drive-time · end of the workday · 14° rainy"). Derived entirely from the
// already-polled /now-playing context: no extra requests, no API cost.
// Segment-by-segment fallback: a station that publishes only part of the
// context still gets its line; a station with none gets nothing.

import { useStationFeed } from '@/hooks/useStationFeed';

export function ContextLine() {
  const { nowPlaying } = useStationFeed();
  const time = nowPlaying?.context?.time;
  const weather = nowPlaying?.context?.weather;

  // temp may arrive fractional — the app shows whole degrees; unit stays bare
  // ("14°") to match it. tempUnit exists on the payload if a fork ever needs it.
  const temp = weather?.temp != null ? `${Math.round(weather.temp)}°` : '';
  const weatherLabel = [temp, weather?.condition || ''].filter(Boolean).join(' ');

  const segments = [time?.period, time?.vibe, weatherLabel || undefined].filter(
    (s): s is string => Boolean(s),
  );
  if (segments.length === 0) return null;

  return (
    <p className="mt-2 truncate font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--pencil)]">
      {segments.join(' · ')}
    </p>
  );
}
