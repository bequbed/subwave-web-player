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
  /**
   * Server-side cast agent. The Google Cast Web Sender SDK (CAF) proved
   * unreliable for this deployment (requestSession fails/hangs on the
   * sender), while a pychromecast bridge on the LAN casts the same stream
   * to the same speakers every time. So the player drives speakers through
   * the bridge instead of the CAF SDK — it even works on iOS/Firefox and
   * from mobile data (the server does the LAN part).
   */
  castBridgeUrl: `${STATION_URL}/cast-bridge`,
  /** Shared token for the cast bridge (homelab-grade; the bridge 401s
   *  without it). Override with VITE_CAST_TOKEN when rotating. */
  castToken: import.meta.env.VITE_CAST_TOKEN ?? '08745ccd338ecf1e06f76b9f06b360b6',
  /** How often the live feed (now-playing / state / session) is polled. */
  pollIntervalMs: 5000,
} as const;
