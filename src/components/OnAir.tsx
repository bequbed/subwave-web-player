// The on-air header: the DJ persona (name, tagline, avatar), the current show
// name, and any guest co-hosts. Falls back to the station-level DJ from
// /now-playing when no show is scheduled.

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

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative shrink-0">
        <Avatar src={hostAvatar} name={hostName} size={38} />
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--signal)] px-1.5 py-px text-[8px] font-black uppercase tracking-[0.12em] text-[var(--bg)] ring-2 ring-[var(--bg)]">
          On&nbsp;air
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-tight">{hostName}</span>
          {show?.name && (
            <span className="inline-block max-w-20 truncate rounded-full border border-[var(--line)] bg-[var(--panel)] px-1.5 py-0.5 text-[9px] text-[var(--muted)] sm:max-w-28">
              {show.name}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[10px] leading-tight text-[var(--muted)]">
            {tagline || (guests.length === 0 ? 'Live radio' : show?.name || 'Live radio')}
          </p>
          {guests.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[8px] uppercase tracking-wide text-[var(--muted)]">with</span>
              <div className="flex -space-x-1.5">
                {guests.map((guest) => (
                  <Avatar
                    key={guest.id}
                    src={resolveUrl(guest.avatar)}
                    name={guest.name}
                    size={18}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
