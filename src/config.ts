// The one place the station origin is resolved. Everything downstream
// (stationClient, the <audio> element) builds its URLs from here, so pointing
// this player at another SUB/WAVE station is a one-line env change.
//
// Every SUB/WAVE deployment serves the same route table on one hostname:
//   /api/*        → the controller (now-playing, state, session, requests, …)
//   /stream.mp3   → the Icecast MP3 mount (the universal audio floor)
//   /stream.flac  → the Icecast lossless mount
// so a single origin URL is all we need.

const STATION_URL = (import.meta.env.VITE_STATION_URL ?? 'https://www.getsubwave.com').replace(
  /\/+$/,
  '',
);

export const config = {
  /** Public site origin, e.g. https://www.getsubwave.com */
  stationUrl: STATION_URL,
  /** Controller API base — all JSON endpoints live under here. */
  apiUrl: `${STATION_URL}/api`,
  /** The always-served MP3 Icecast mount (the universal audio floor). */
  mp3StreamUrl: `${STATION_URL}/stream.mp3`,
  /** The lossless Icecast mount, preferred when the browser supports FLAC. */
  flacStreamUrl: `${STATION_URL}/stream.flac`,
  /** How often the live feed (now-playing / state / session) is polled. */
  pollIntervalMs: 5000,
} as const;
