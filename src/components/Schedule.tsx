// The weekly grid from /schedule: 7 days × 24 hours, each slot either empty or
// anchored to a show. Times are painted in the STATION's timezone (the DJ
// speaks in that zone), so we compute "now" in that zone to highlight the live
// slot rather than trusting the viewer's local clock.
//
// LONGWAVE prints this as a chart: zebra banding, hairline cells, muted
// per-show tints, and the live hour as a solid ember fill with paper text.
// It stays a semantic <table> with all 168 slots focusable.

import { useMemo } from 'react';
import { useSchedule } from '@/hooks/useSchedule';
import { Panel } from '@/components/ui/Panel';
import { dayName, hourLabel } from '@/lib/format';
import type { ScheduleShow } from '@/lib/types';

/** A deterministic, desaturated tint per show — printed-chart ink, not neon.
 *  Local to the presentation layer; `gradientFor` stays for the dark-friendly
 *  avatar fallbacks. */
function showTint(seed: string): string {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 26% 80%)`;
}

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
          <span className="truncate text-[11px] text-[var(--pencil)]">
            station time · {data.timezone}
          </span>
        ) : undefined
      }
      className="h-full"
    >
      <div className="flex h-full min-w-0 flex-col">
        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--pencil)]">Loading schedule…</p>
        ) : error || !data ? (
          <p className="py-8 text-center text-sm text-[var(--pencil)]">
            No schedule available for this station.
          </p>
        ) : (
          <>
            {/* The grid scrolls inside this panel only — never widening the page. */}
            <div className="scroll-thin min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4">
              {/* `relative` is load-bearing: the per-slot `sr-only` spans are
                  absolutely positioned, and without a positioned ancestor
                  inside this scroller their containing block would be #root —
                  which leaks the 720px grid out and widens the whole page at
                  320px. */}
              <div className="relative min-w-[720px]">
                <table className="w-full table-fixed border-separate border-spacing-x-px border-spacing-y-0">
                  <caption className="sr-only">
                    Weekly station schedule. Each focusable slot identifies its day, hour, show, and whether it is current.
                  </caption>
                  <colgroup>
                    <col className="w-11" />
                    {HOURS.map((h) => (
                      <col key={h} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-[var(--rule)] pb-1.5">
                        <span className="sr-only">Day</span>
                      </th>
                      {HOURS.map((h) => (
                        <th
                          key={h}
                          scope="col"
                          aria-label={hourLabel(h)}
                          className={`border-b border-[var(--rule)] pb-1.5 text-center text-[11px] tabular-nums ${
                            h === now.hour
                              ? 'font-semibold text-[var(--ember)]'
                              : 'font-normal text-[var(--pencil)]'
                          }`}
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
                      const zebra = d % 2 === 1;
                      return (
                        <tr key={d}>
                          <th
                            scope="row"
                            className="h-7 pr-2 text-right text-[11px] font-medium text-[var(--pencil)]"
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
                                className={`h-6 rounded-[2px] border p-0 focus-visible:relative focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ember)] ${
                                  isNow || show ? 'border-[var(--rule)]' : 'border-transparent'
                                }`}
                                style={{
                                  background: isNow
                                    ? 'var(--ember)'
                                    : show
                                      ? showTint(show.id)
                                      : zebra
                                        ? 'var(--leaf-raised)'
                                        : 'color-mix(in srgb, var(--leaf-raised) 45%, var(--leaf))',
                                  color: isNow ? 'var(--paper)' : undefined,
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
              </div>
            </div>

            {/* Legend — outside the scroller so it wraps to the panel width. */}
            {data.shows.length > 0 && (
              <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 border-t border-[var(--rule)] px-3 py-3 sm:px-4">
                {data.shows.slice(0, 8).map((s) => (
                  <span
                    key={s.id}
                    className="flex min-w-0 items-center gap-2 text-[11px] text-[var(--pencil)]"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] border border-[var(--rule)]"
                      style={{ background: showTint(s.id) }}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
