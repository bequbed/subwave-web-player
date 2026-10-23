// Pure derivations for the Drift skin (ported from upstream SUB/WAVE shared.ts).

import type {
  ActiveShow,
  NowPlayingResponse,
  QueueEntry,
  SessionMessage,
  StationContext,
  StationLocale,
} from '@/lib/types';

export interface StationIdentity {
  stationName: string;
  djName: string;
  showName: string;
}

export function stationIdentity(
  dj: NowPlayingResponse['dj'] | null | undefined,
  activeShow: ActiveShow | null | undefined,
  context: StationContext | null | undefined,
): StationIdentity {
  return {
    stationName: (typeof dj?.station === 'string' && dj.station) || 'SUB/WAVE',
    djName:
      activeShow?.persona?.name || (typeof dj?.name === 'string' ? dj.name : '') || 'the DJ',
    showName: activeShow?.name || context?.time?.show || '',
  };
}

/** The DJ's most recent spoken line, or null. Only `segment` turns are voice
 *  (upstream sessionFeed.turnClass); `dj`/`event` turns are picks and prompts.
 *  Carried turns belong to the previous show's tail. */
export function lastVoiceLine(messages: SessionMessage[]): { text: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'segment' || m.meta?.carried === true) continue;
    const text = (m.text ?? '').trim();
    if (text) return { text };
  }
  return null;
}

/** When a history entry aired, as a parseable string. */
export function entryTime(e: QueueEntry | null | undefined): string | undefined {
  if (!e) return undefined;
  const rec = e as unknown as Record<string, unknown>;
  for (const v of [rec['startedAt'], e.t, rec['queuedAt']]) {
    if (typeof v === 'string' && Number.isFinite(Date.parse(v))) return v;
  }
  return undefined;
}

/** "drive home · 16° cloudy"; pieces omitted when absent. */
export function contextLine(context: StationContext | null | undefined): string {
  const parts: string[] = [];
  const vibe = context?.time?.vibe || context?.time?.show;
  if (vibe) parts.push(String(vibe));
  const w = context?.weather;
  if (w && (w.temp != null || w.condition)) {
    parts.push(
      [w.temp != null ? `${Math.round(w.temp)}°` : '', w.condition ?? '']
        .filter(Boolean)
        .join(' '),
    );
  }
  return parts.join(' · ');
}

/** 0..1 progress through the track, or null when the duration is unknown. */
export function progressRatio(elapsed: number, duration: number | undefined): number | null {
  if (!duration || duration <= 0) return null;
  return Math.min(1, Math.max(0, elapsed / duration));
}

/** "02:21 pm" (en-US) or "14:21" (en-GB) in the station's zone. */
export function fmtClockMinute(
  date: Date,
  timezone: string | null | undefined,
  locale: StationLocale = 'en-US',
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: locale !== 'en-GB',
      timeZone: timezone || undefined,
    })
      .format(date)
      .toLowerCase();
  } catch {
    return '--:--';
  }
}

export function turnClock(
  t: string | number | undefined,
  timezone: string | null | undefined,
  locale: StationLocale,
): string {
  if (t == null) return '--:--';
  const date = new Date(t);
  if (Number.isNaN(date.getTime())) return '--:--';
  return fmtClockMinute(date, timezone, locale);
}

/** Lowercase weekday in the station's zone. */
export function stationWeekday(now: Date, timezone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      timeZone: timezone || undefined,
    })
      .format(now)
      .toLowerCase();
  } catch {
    return '';
  }
}
