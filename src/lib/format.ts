// Small, pure display helpers. Kept side-effect-free so they're the natural
// place to add unit tests (Vitest) if you extend this starter.

/** Seconds → `m:ss` (or `h:mm:ss` past an hour). Negative/NaN → `0:00`. */
export function clock(totalSeconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Compact "time ago" for history/booth timestamps. Accepts ms epoch or ISO. */
export function timeAgo(input: number | string | undefined | null): string {
  if (input == null) return '';
  const then = typeof input === 'number' ? input : Date.parse(input);
  if (!Number.isFinite(then)) return '';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 5) return 'now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Human listener count from the `/now-playing` `listeners` field (number or
 *  `{ current }`). Returns null when unknown so the UI can hide the pill. */
export function listenerCount(l: number | { current?: number } | undefined): number | null {
  if (typeof l === 'number') return l;
  if (l && typeof l.current === 'number') return l.current;
  return null;
}

/** Compact integer, e.g. 12_400 → "12.4k". For the LLM token ticker. */
export function compact(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  if (v < 1000) return String(Math.round(v));
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

/** A deterministic accent gradient derived from a string (track/album id), used
 *  as a cover-art fallback so a missing image never shows a broken icon. */
export function gradientFor(seed: string | undefined | null): string {
  let h = 0;
  for (const ch of String(seed ?? 'subwave')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const h2 = (h + 48) % 360;
  return `linear-gradient(135deg, hsl(${h} 65% 32%), hsl(${h2} 55% 20%))`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function dayName(dow: number): string {
  return DAYS[dow] ?? '';
}

/** `14` → `2pm`, `0` → `12am`. For the schedule grid axis. */
export function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? 'am' : 'pm';
  const base = hr % 12 === 0 ? 12 : hr % 12;
  return `${base}${ampm}`;
}
