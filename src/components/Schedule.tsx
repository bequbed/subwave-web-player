// The weekly grid from /schedule: 7 days × 24 hours, each slot either empty or
// anchored to a show. Times are painted in the STATION's timezone (the DJ
// speaks in that zone), so we compute "now" in that zone to highlight the live
// slot rather than trusting the viewer's local clock.

import { useMemo } from 'react';
import { useSchedule } from '@/hooks/useSchedule';
import { Panel } from '@/components/ui/Panel';
import { dayName, gradientFor, hourLabel } from '@/lib/format';
import type { ScheduleShow } from '@/lib/types';

/** Current { dow (0=Sun), hour } in an IANA timezone, via Intl. Falls back to
 *  the viewer's local time if the zone is missing/invalid. */
function nowInZone(tz: string | null | undefined): { dow: number; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dow: dowMap[wd] ?? 0, hour: Number(hourStr) % 24 };
  } catch {
    const d = new Date();
    return { dow: d.getDay(), hour: d.getHours() };
  }
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function Schedule() {
  const { data, loading, error } = useSchedule();

  const showsById = useMemo(() => {
    const m = new Map<string, ScheduleShow>();
    for (const s of data?.shows ?? []) m.set(s.id, s);
    return m;
  }, [data]);

  const now = useMemo(() => nowInZone(data?.timezone), [data?.timezone]);

  return (
    <Panel
      title="Weekly schedule"
      aside={
        data?.timezone ? (
          <span className="text-[10px] text-[var(--muted)]">station time · {data.timezone}</span>
        ) : undefined
      }
      className="h-full"
    >
      <div className="scroll-thin h-full overflow-auto p-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Loading schedule…</p>
        ) : error || !data ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            No schedule available for this station.
          </p>
        ) : (
          <div className="min-w-[560px]">
            {/* Hour axis */}
            <div className="grid grid-cols-[36px_repeat(24,1fr)] gap-px">
              <div />
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="pb-1 text-center text-[9px] text-[var(--muted)]"
                >
                  {h % 3 === 0 ? hourLabel(h) : ''}
                </div>
              ))}
            </div>
            {/* Rows */}
            {DAYS.map((d) => {
              const row = data.schedule?.[d] ?? [];
              return (
                <div key={d} className="grid grid-cols-[36px_repeat(24,1fr)] items-center gap-px">
                  <div className="pr-1 text-right text-[10px] font-medium text-[var(--muted)]">
                    {dayName(d)}
                  </div>
                  {HOURS.map((h) => {
                    const showId = row[h] ?? null;
                    const show = showId ? showsById.get(showId) : null;
                    const isNow = d === now.dow && h === now.hour;
                    return (
                      <div
                        key={h}
                        title={show ? `${show.name} · ${hourLabel(h)}` : hourLabel(h)}
                        className={`h-6 rounded-[3px] ${isNow ? 'ring-2 ring-[var(--accent)]' : ''}`}
                        style={{
                          background: show ? gradientFor(show.id) : 'var(--panel-2)',
                          opacity: show ? 1 : 0.5,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Legend */}
            {data.shows.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.shows.slice(0, 8).map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                    <span
                      className="inline-block h-3 w-3 rounded-[3px]"
                      style={{ background: gradientFor(s.id) }}
                    />
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
