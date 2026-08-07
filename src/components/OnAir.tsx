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
    <div className="flex items-center gap-3">
      <div className="relative">
        <Avatar src={hostAvatar} name={hostName} size={48} />
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-red-500 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide text-white ring-2 ring-[var(--bg)]">
          On&nbsp;air
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{hostName}</span>
          {show?.name && (
            <span className="truncate rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
              {show.name}
            </span>
          )}
        </div>
        {tagline ? (
          <p className="truncate text-xs text-[var(--muted)]">{tagline}</p>
        ) : (
          guests.length === 0 && <p className="text-xs text-[var(--muted)]">Live radio</p>
        )}
        {guests.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">with</span>
            <div className="flex -space-x-1.5">
              {guests.map((g) => (
                <Avatar key={g.id} src={resolveUrl(g.avatar)} name={g.name} size={20} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
