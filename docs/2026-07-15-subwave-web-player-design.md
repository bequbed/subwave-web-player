# SUB/WAVE Web Player Starter — Design

**Date:** 2026-07-15
**Repo:** `subwave-web-player` (standalone, own git)
**Stack:** Vite + React 19 + TypeScript + Tailwind CSS v4

## Purpose

A lean, readable reference web player for a SUB/WAVE internet radio station. It
points at the live public station (`https://www.getsubwave.com`) out of the box,
so `npm install && npm run dev` shows a real, playing station with zero config.

It is a **starter template**: intentionally minimal and meant to be cloned and
restyled. The single load-bearing architectural rule is **strict separation of
the data layer from the presentation layer** — a redesigner keeps the plumbing
(API client + hooks) and replaces only the components.

It also doubles as informal documentation of SUB/WAVE's public HTTP surface: the
README maps every endpoint to what it powers.

## Non-goals

Deliberately omitted to stay lean (documented in the README as "the flagship
player also does X — here's the endpoint", not implemented):

- Theme engine / multi-skin registry (`/themes`, `/state.ui.skin`)
- PWA manifest / installability / dynamic OG icons
- Audience analytics beacon (`POST /beacon`)
- Opus codec upgrade + `canPlayType` probing (MP3 only)
- Persona/skill/show community catalogs

## The station API (what we consume)

All endpoints are unauthenticated, CORS wide-open (`Access-Control-Allow-Origin: *`),
and the Icecast mount sends the same, so cross-origin fetch + `crossOrigin`
`<audio>` work from any dev server. Base = `${VITE_STATION_URL}/api`.

| Endpoint | Powers |
| --- | --- |
| `GET /now-playing` | Cover art, title/artist/album, metadata strip (genre·BPM·key·mood·energy), duration, DJ persona, active show + guests, listener count, stream online/bitrate, LLM token ticker, timezone/locale |
| `GET /state` | Queue (upcoming) + history (recently played) + DJ log |
| `GET /session` | Booth feed — the live DJ session chat turns (`{t, role, kind, text, meta}`) |
| `GET /schedule` | Weekly 7×24 grid + shows + personas |
| `POST /request` | Submit a listener song request → returns `{ requestId }` |
| `GET /request/:id` | Poll a request's outcome (`pending`/`resolved`/`failed`/`unknown`) |
| `GET /cover/:id` | Cover-art proxy (MediaSession artwork) |
| `GET /persona-avatar/:id` | DJ persona portrait (1×1 transparent PNG placeholder if unset) |
| `GET /health` | Liveness (signal dot) |
| `GET /stream.mp3` | The audio itself (Icecast, not under `/api`) |

## Config

`src/config.ts`:

```ts
const STATION_URL = (import.meta.env.VITE_STATION_URL ?? 'https://www.getsubwave.com')
  .replace(/\/+$/, '');
export const config = {
  stationUrl: STATION_URL,
  apiUrl: `${STATION_URL}/api`,
  streamUrl: `${STATION_URL}/stream.mp3`,
};
```

`.env.example` documents `VITE_STATION_URL`. Point it at `http://localhost:7700`
for a local install, or any other SUB/WAVE origin.

## Architecture

```
src/
  config.ts                 # station origin → apiUrl + streamUrl
  main.tsx                  # React root
  App.tsx                   # layout: composes the components below
  index.css                 # Tailwind entry + a few CSS vars

  lib/                      # ── DATA LAYER (keep when redesigning) ──
    types.ts                # response types (subset of the real ones)
    stationClient.ts        # the ONLY module that fetches the controller
    format.ts               # tiny pure helpers (time mm:ss, relative time)

  hooks/                    # ── DATA LAYER (keep when redesigning) ──
    useStationFeed.ts       # polls /now-playing + /state + /session every 5s
    usePlayer.ts            # <audio> element: play/pause, volume, tune-in gate
    useElapsed.ts           # derives elapsed seconds for the track clock
    useRequest.ts           # submit a song request + poll its status
    useSchedule.ts          # fetch /schedule once
    useMediaSession.ts      # lock-screen metadata + artwork

  components/               # ── PRESENTATION (redesign this) ──
    NowPlaying.tsx
    PlayerBar.tsx
    OnAir.tsx
    BoothFeed.tsx
    Queue.tsx
    RequestBox.tsx
    Schedule.tsx
    ui/                     # small shared bits: Avatar, SignalDot, Marquee
```

### Data flow

1. `App` renders a single `<StationFeedProvider>` (React context) that runs
   `useStationFeed` once and shares the polled snapshot. Every component reads
   from context — one poll loop, not N.
2. `usePlayer` owns the single `<audio crossOrigin="anonymous">` element and
   exposes `{ playing, tuneIn(), toggle(), volume, setVolume }`. Autoplay is
   blocked by browsers, so playback starts only on the first user gesture
   (the "tune in" tap) — mirrors the real player's tune-in gate.
3. `useElapsed` takes the current track's `subsonic_id` + `duration` from the
   feed and advances a local second counter, resetting when the id changes.
   (The controller does not stream a live playhead; the clock is client-side
   and re-syncs on every track change.)
4. `useRequest` posts to `/request`, then polls `/request/:id` every ~2s until
   the status is terminal, exposing `{ submit, state }` to `RequestBox`.

### Polling

Single 5s interval in `useStationFeed`, `Promise.all` over the three feed
endpoints. Pauses when `document.hidden` (matches the real hook — a hidden tab
should not poll). `/schedule` is fetched once by `useSchedule` (it rarely
changes). Request polling is a separate short-lived 2s loop while a request is
in flight.

### Error / empty states

- Feed fetch failure → keep last good snapshot, show a muted "reconnecting…"
  hint via a signal dot; never blank the UI.
- No track / station offline → an EMPTY state ("station is off air").
- Untagged track → metadata strip fields simply omit (all optional).
- Missing cover → fall back to a generated gradient block (no broken image).
- Request `unknown`/`failed` → a friendly card, not an error toast.

## Styling

Tailwind CSS v4 (`@import "tailwindcss"` in `index.css`, `@tailwindcss/vite`
plugin — no `tailwind.config.js` needed for v4). A small set of CSS custom
properties in `:root` (`--bg`, `--fg`, `--accent`, `--muted`) referenced from
Tailwind arbitrary values, so a redesigner can reskin by editing a handful of
vars before touching components. Dark theme by default; the layout is a single
responsive column that works on phone and desktop.

## Testing / quality

- No heavy test runner (matches the starter ethos). `npm run lint` =
  `eslint . && tsc --noEmit`, wired in `package.json` and a minimal flat ESLint
  config. Pure helpers in `lib/format.ts` are the natural unit-test seam if the
  cloner wants to add Vitest later (noted in README, not shipped).
- Manual verification: `npm run dev`, confirm the live station loads, plays on
  tap, shows now-playing + booth + queue + schedule, and a request round-trips.

## README

- Screenshot / short description
- Quickstart (`npm install`, `npm run dev`)
- "Point at your own station" (`VITE_STATION_URL`)
- **Architecture: data vs presentation** — the one thing to understand before
  redesigning
- **Public API reference table** (the table above) — every endpoint + what it
  powers, so this repo documents the client surface
- "What the flagship player also does" — the non-goals, with endpoints, as
  pointers for anyone going further
- License (MIT)

## Build order

1. Scaffold: Vite React-TS, add Tailwind v4, ESLint flat config, `.env.example`,
   `.gitignore`, `config.ts`.
2. Data layer: `types.ts`, `stationClient.ts`, `format.ts`.
3. Hooks: `useStationFeed` (+ provider), `usePlayer`, `useElapsed`,
   `useRequest`, `useSchedule`, `useMediaSession`.
4. Components + `App` layout, styled with Tailwind.
5. README + screenshot, final `npm run lint`, initial commit.
