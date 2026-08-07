---
name: connect-station
description: >-
  Point this SUB/WAVE web player at a specific station instead of the default
  public one — a self-hosted install, a LAN box, localhost, or someone else's
  station — and diagnose why a player is blank, silent, stuck "connecting", or
  showing no track. Use this WHENEVER the user wants to connect to their own
  station, change the station/API/stream URL, use a local or self-hosted
  SUB/WAVE, set VITE_STATION_URL, or troubleshoot a player that loads but shows
  no data, won't play audio, or reports the station offline. Because the station
  URL is baked in at build time, "it didn't update" problems are common — this
  skill knows to rebuild.
---

# Connecting the player to a station

This player talks to exactly one SUB/WAVE station, resolved from a single
setting. Getting it to point somewhere new — and diagnosing when it doesn't
work — is almost always about that one setting and the build-time gotcha around
it.

## The one setting

`VITE_STATION_URL` is the whole config surface. From that origin, `src/config.ts`
derives everything:

- `${VITE_STATION_URL}/api` — the controller (now-playing, state, session,
  requests, schedule)
- `${VITE_STATION_URL}/stream.mp3` — the Icecast audio mount

Every SUB/WAVE deployment serves that same route table on one hostname, so the
site origin is all you need. Unset, it defaults to the public station
(`https://www.getsubwave.com`).

To point it somewhere else, set it in `.env` (copy from `.env.example`):

```bash
VITE_STATION_URL=http://localhost:7700        # a local install
# VITE_STATION_URL=https://radio.example.com  # a self-hosted station
```

## The build-time gotcha (read this before debugging "it didn't change")

All Vite `VITE_*` variables are **inlined at build time**, not read at runtime.
So:

- In **dev** (`npm run dev`): editing `.env` requires **restarting the dev
  server** — Vite reads env at startup. A hot reload won't pick it up.
- In **production** (a built `dist/`, a Docker image, a deploy): the value is
  frozen into the JS bundle. Changing the station means a **rebuild**
  (`npm run build`, or `docker compose up -d --build`, or a redeploy with the new
  env var), never just a restart.

If the user swears they changed the URL "but it still shows the old station",
it's almost always one of these two:

1. **The bundle was never rebuilt** (or the dev server wasn't restarted) — see
   above. Confirm what origin a built bundle actually points at:

   ```bash
   grep -oE 'https?://[a-zA-Z0-9.:_-]+' dist/assets/*.js | sort -u
   ```

   Grep for the bare **origin**, not `origin/api`: `config.ts` builds the API URL
   as `` `${STATION_URL}/api` ``, so after minification the origin and `/api` are
   separate string literals and there is no contiguous `.../api` substring to
   match.

2. **A stale `.env.local` is winning.** Vite loads `.env.local` at higher
   priority than `.env`, so if one exists with an old `VITE_STATION_URL`, editing
   `.env` silently has no effect. Check for it: `ls -la .env*` and reconcile.

Also note `.env` is gitignored — the change is local only. For a deployed build
the station URL must be supplied to the build/deploy environment separately (a
build arg / platform env var), not via a committed file.

## Verifying a station is reachable before blaming the player

The player is a thin client. If it's blank or offline, check the station itself
first — these are unauthenticated and CORS-open, so `curl` from anywhere works:

```bash
BASE=http://localhost:7700          # the VITE_STATION_URL you're using
curl -s "$BASE/api/health"          # → {"status":"on-air"}
curl -s "$BASE/api/now-playing" | head -c 300   # → a track, or nowPlaying:null
curl -sI "$BASE/stream.mp3" | head  # → 200 + audio/mpeg while on air
```

If `/api/health` fails, the problem is the station (down, wrong URL, wrong port),
not the player.

## Troubleshooting a misbehaving player

Work down this list — it's ordered by how common each cause is.

- **Player loads but shows no data / stuck "connecting".** The API base is wrong
  or unreachable. Verify `VITE_STATION_URL` and that `curl "$BASE/api/health"`
  works. Remember the build-time gotcha — check what's actually baked in.
- **"Station is off air" / null track, but data otherwise loads.** This is a
  *correct* state — the station genuinely isn't broadcasting. `now-playing`
  returns `nowPlaying: null`. Not a bug; the UI is doing its job.
- **Everything shows but audio won't play.** First: audio needs a user gesture
  (tap the play/tune-in control) — browsers block autoplay. If it still won't
  play, `curl -sI "$BASE/stream.mp3"` — a 404 means the stream is down or the
  mount path differs.
- **Mixed-content block (HTTPS page → HTTP station).** A player served over
  `https://` cannot fetch or stream from an `http://` station — the browser
  blocks it silently (see the console). Either serve the player over http for a
  LAN box, or put the station behind HTTPS. This bites LAN/self-hosted setups.
- **CORS error in the console.** The SUB/WAVE controller and Icecast are both
  wide-open (`Access-Control-Allow-Origin: *`), so a genuine CORS failure usually
  means you're hitting something that *isn't* a SUB/WAVE origin — a wrong URL, a
  login/proxy page, or an error page. Re-check the URL.
- **`localhost` from another device.** `localhost` in `VITE_STATION_URL` resolves
  on the *viewer's* machine. To reach a station on another box, use its LAN IP or
  hostname (`http://192.168.x.x:7700`), not `localhost`.

## After changing the station

Always leave the user with a verified result, not just an edited file:

1. Restart dev (`npm run dev`) or rebuild for prod.
2. Confirm the player loads the intended station — the header shows the station
   name and host, and a track should appear if it's on air.
