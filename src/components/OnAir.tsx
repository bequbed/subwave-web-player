// The on-air byline: the DJ persona (name, tagline, avatar), the current show
// name, and any guest co-hosts. Falls back to the station-level DJ from
// /now-playing when no show is scheduled.
//
// LONGWAVE folds this into the masthead, so it reads as a byline under the
// station name rather than a badge. The ON AIR stamp now lives on the plate.

import { useStationFeed } from '@/hooks/useStationFeed';
import { resolveUrl } from '@/lib/stationClient';
import { Avatar } from '@/components/ui/Avatar';

export function OnAir() {
  const { nowPlaying } = useStationFeed();
  const show = nowPlaying?.activeShow ?? nowPlaying?.context?.activeShow ?? null;
  const dj = nowPlaying?.dj;

  const hostName = show?.persona?.name || dj?.name || 'Auto DJ';
  const hostAvatar = resolveUrl(show?.persona?.avatar || dj?.avatar);
  const tagline = dj?.tagline || '';
  const guests = show?.guests ?? [];

  const byline = [show?.name, tagline].filter(Boolean).join(' · ') || 'Live radio';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar src={hostAvatar} name={hostName} size={34} />

      <div className="min-w-0">
        <p className="min-w-0 break-words text-[13px] font-semibold leading-tight text-[var(--graphite)]">
          {hostName}
        </p>
        <p className="mt-0.5 min-w-0 break-words text-[11px] leading-snug text-[var(--pencil)]">
          {byline}
        </p>
      </div>

      {guests.length > 0 && (
        <div className="flex min-w-0 items-center gap-1.5 border-l border-[var(--rule)] pl-3">
          <span className="text-[11px] uppercase leading-none tracking-[0.16em] text-[var(--pencil)]">
            with
          </span>
          <div className="flex flex-wrap gap-1">
            {guests.map((guest) => (
              <Avatar key={guest.id} src={resolveUrl(guest.avatar)} name={guest.name} size={20} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
