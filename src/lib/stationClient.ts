// The ONLY module that talks to a SUB/WAVE controller. Every fetch and every
// controller-relative URL (cover art, persona avatars) is built here from the
// station origin in config.ts. Keep it this way — if you redesign the UI, this
// file and the hooks are the plumbing you keep; the components are what you
// replace.
//
// Response posture mirrors the real player: feed endpoints parse JSON directly,
// /schedule throws on non-OK, /request/:id maps a 404 to status 'unknown'.

import { config } from '@/config';
import type {
  NowPlayingResponse,
  RequestResult,
  SchedulePayload,
  SessionPayload,
  StationState,
} from '@/lib/types';

const api = config.apiUrl;

const json = <T>(res: Response): Promise<T> => res.json() as Promise<T>;

/** Prefix a controller-relative path (e.g. `/persona-avatar/p_x`) with the
 *  station's API base. Empty input stays '' so `<img>` fallbacks keep working. */
export function resolveUrl(path: string | null | undefined): string {
  return path ? `${api}${path}` : '';
}

/** Cover-art proxy URL for a library track id. */
export function coverUrl(subsonicId: string): string {
  return `${api}/cover/${encodeURIComponent(subsonicId)}`;
}

export function fetchNowPlaying(): Promise<NowPlayingResponse> {
  return fetch(`${api}/now-playing`).then((r) => json<NowPlayingResponse>(r));
}

export function fetchState(): Promise<StationState> {
  return fetch(`${api}/state`).then((r) => json<StationState>(r));
}

export function fetchSession(): Promise<SessionPayload> {
  return fetch(`${api}/session`).then((r) => json<SessionPayload>(r));
}

export async function fetchSchedule(): Promise<SchedulePayload> {
  const r = await fetch(`${api}/schedule`);
  if (!r.ok) throw new Error(`schedule fetch ${r.status}`);
  return json<SchedulePayload>(r);
}

/** Cheap liveness GET for the signal dot. Caller owns any timeout/abort. */
export function fetchHealth(init?: { signal?: AbortSignal }): Promise<Response> {
  return fetch(`${api}/health`, { cache: 'no-store', signal: init?.signal });
}

/** Submit a listener song request. Returns immediately with a `requestId` to
 *  poll; the actual matching + enqueue happens in the background on the server. */
export async function submitRequest(text: string, name: string): Promise<RequestResult> {
  const r = await fetch(`${api}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, name }),
  });
  return json<RequestResult>(r);
}

/** Poll a request's outcome. 404 → 'unknown'; network error → null so the
 *  caller can keep polling. */
export async function fetchRequestStatus(requestId: string): Promise<RequestResult | null> {
  try {
    const r = await fetch(`${api}/request/${encodeURIComponent(requestId)}`);
    if (r.status === 404) return { success: false, status: 'unknown' };
    return await json<RequestResult>(r);
  } catch {
    return null;
  }
}
