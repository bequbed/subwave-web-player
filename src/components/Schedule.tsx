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
      className="h-full overflow-hidden"
    >
      <div className="scroll-thin h-full overflow-auto p-3 sm:p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Loading schedule…</p>
        ) : error || !data ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            No schedule available for this station.
          </p>
        ) : (
          <div className="min-w-[560px]">
            <table className="w-full table-fixed border-separate border-spacing-x-px border-spacing-y-0">
              <caption className="sr-only">
                Weekly station schedule. Each focusable slot identifies its day, hour, show, and whether it is current.
              </caption>
              <colgroup>
                <col className="w-9" />
                {HOURS.map((h) => (
                  <col key={h} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-[var(--line)] pb-1">
                    <span className="sr-only">Day</span>
                  </th>
                  {HOURS.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      aria-label={hourLabel(h)}
                      className={`rounded-sm border-b border-[var(--line)] pb-1 text-center text-[9px] font-normal ${h === now.hour ? 'bg-[var(--signal)]/10 font-semibold text-[var(--signal)]' : 'text-[var(--muted)]'}`}
                    >
                      {h % 3 === 0 ? hourLabel(h) : <span aria-hidden="true">&nbsp;</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => {
                  const row = data.schedule?.[d] ?? [];
                  const day = dayName(d);
                  return (
                    <tr key={d}>
                      <th
                        scope="row"
                        className="h-7 pr-1 text-right text-[10px] font-medium text-[var(--muted)]"
                      >
                        {day}
                      </th>
                      {HOURS.map((h) => {
                        const showId = row[h] ?? null;
                        const show = showId ? showsById.get(showId) : null;
                        const isNow = d === now.dow && h === now.hour;
                        const slotTitle = show ? `${show.name} · ${hourLabel(h)}` : hourLabel(h);
                        const slotLabel = `${day}, ${hourLabel(h)}: ${show?.name ?? 'No show scheduled'}${isNow ? ', current slot' : ''}`;
                        return (
                          <td
                            key={h}
                            tabIndex={0}
                            title={slotTitle}
                            aria-label={slotLabel}
                            aria-current={isNow ? 'time' : undefined}
                            className={`h-6 rounded-[3px] border p-0 focus-visible:relative focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--signal)] ${show ? 'border-white/10' : 'border-white/[0.025]'} ${isNow ? 'relative z-10 ring-2 ring-[var(--signal)] ring-offset-1 ring-offset-[var(--panel)]' : ''}`}
                            style={{
                              background: isNow
                                ? `${show ? 'linear-gradient(rgb(199 243 107 / 0.18), rgb(199 243 107 / 0.18)), ' : ''}${show ? gradientFor(show.id) : 'rgb(199 243 107 / 0.16)'}`
                                : show
                                  ? gradientFor(show.id)
                                  : 'var(--panel-2)',
                              opacity: show || isNow ? 1 : 0.22,
                            }}
                          >
                            <span className="sr-only">{slotLabel}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Legend */}
            {data.shows.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-[var(--line)] pt-3">
                {data.shows.slice(0, 8).map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-[var(--fg)]/75">
                    <span
                      className="inline-block h-3 w-3 rounded-[3px] border border-white/15"
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
