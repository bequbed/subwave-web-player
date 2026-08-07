# Hooks API — the data contract to design against

Every component gets its data from these hooks. This is what's available to
render. Full response types live in `src/lib/types.ts`; the hooks themselves are
in `src/hooks/`. Import paths use the `@/` alias (`@/hooks/...`, `@/lib/...`).

## `useStationFeed()` → `StationFeed`

The shared live snapshot, refreshed every 5s. Read it from any component; there
is exactly one poll loop (mounted by `<StationFeedProvider>` in `App.tsx`) — do
not add your own.

```ts
const { nowPlaying, state, session, ready, online } = useStationFeed();
```

- `ready` — `false` until the first poll lands. Use it to show skeletons and to
  distinguish "still loading" from "genuinely nothing playing".
- `online` — `true` while the latest poll succeeded; `false` means you're looking
  at a stale snapshot (show a "reconnecting" hint, don't blank the UI).
- `nowPlaying` (`NowPlayingResponse | null`): the centrepiece.
  - `nowPlaying.nowPlaying` (`NowPlayingTrack | null`): `title`, `artist`,
    `album`, `year`, `duration` (seconds), `subsonic_id`, and optional acoustic
    tags `genre`, `bpm`, `musicalKey`, `moods: string[]`, `energy`
    (`'low'|'medium'|'high'`). Any tag can be absent.
  - `nowPlaying.dj`: `{ name, tagline, avatar, station }` — the on-air DJ persona.
  - `nowPlaying.activeShow`: `{ name, persona:{id,name,avatar}, guests:[…] }` or
    null — the current show + guest co-hosts.
  - `nowPlaying.listeners` — a number or `{ current }`. Use `listenerCount()`
    from `@/lib/format` to normalize.
  - `nowPlaying.streamBitrate`, `nowPlaying.llmTokens` (cumulative DJ token
    ticker), `nowPlaying.timezone`, `nowPlaying.locale`.
- `state` (`StationState | null`): `upcoming: QueueEntry[]`, `history:
  QueueEntry[]`, `djLog: DjLogEntry[]`. A `QueueEntry` has `title`, `artist`,
  `album`, `subsonic_id`, `requestedBy?`, `t?` (ISO time on history).
- `session` (`SessionPayload | null`): the Booth feed. `session.messages` is an
  array of `{ t, role, kind, text, meta }` — what the AI DJ said/queued this
  session. `kind` is e.g. `intro | link | request | station-id | weather`.

## `usePlayer()` → `Player`

Owns the single `<audio>` element. Call `usePlayer()` once high in the tree
(currently in `App.tsx`'s `PlayerView`) and pass it down, or call where you build
the transport controls.

```ts
const { playing, tunedIn, loading, volume, muted,
        tuneIn, toggle, setVolume, toggleMute } = usePlayer();
```

- `tuneIn()` — start playback. **Must be called from a user gesture** (click/tap).
- `toggle()` — play if paused, pause if playing.
- `playing`, `loading` (buffering), `tunedIn` (has the gesture gate been passed).
- `volume` (0–1), `setVolume(v)`, `muted`, `toggleMute()`.
- No seek, no skip — by design (shared live stream).

## `useElapsed(trackKey, active)` → `number`

Client-side track clock (the server streams no playhead). Pass the current
track's `subsonic_id` (or title) as `trackKey` and the player's `playing` as
`active`. Returns seconds since the track changed; resets on `trackKey` change.
Combine with `track.duration` for a progress bar. It's approximate — it re-syncs
every track change, which is fine for a live stream.

## `useRequest()` → `{ state, submit, reset }`

Listener song requests (plain-language: "play Diljit latest", "something rainy").

```ts
const { state, submit, reset } = useRequest();
submit(text, name);   // POSTs, then polls the outcome
```

- `state.phase`: `'idle' | 'submitting' | 'pending' | 'done'`.
- `state.status` (when done): `'resolved' | 'failed' | 'unknown'`.
- `state.result`: `{ track?, reply?, message? }` — `track` is `{title, artist}`,
  `reply` is the DJ's acknowledgement line.
- `reset()` — clear back to idle for another request.

## `useSchedule()` → `{ data, loading, error }`

Fetched once (not in the 5s loop). `data` is `{ personas, shows, schedule,
timezone }`. `schedule` is a 7-key map (0=Sun..6=Sat), each a 24-slot array of
`showId | null`. Times are in the **station's** timezone (`data.timezone`), not
the viewer's — compute "now" in that zone if you highlight the live slot (see
`src/components/Schedule.tsx` for the `Intl.DateTimeFormat` pattern).

## `useMediaSession(track, station, playing, { onPlay, onPause })`

Wires OS lock-screen / headphone / CarPlay metadata + artwork. Next/prev/seek are
deliberately left unwired (shared live stream). Call it once with the current
track; no return value.

## Helpers in `@/lib/format`

`clock(seconds)` → `m:ss`; `timeAgo(t)`; `listenerCount(l)`; `compact(n)` (e.g.
`12.4k`, for the token ticker); `gradientFor(seed)` (deterministic cover-art
fallback gradient); `dayName(dow)`, `hourLabel(h)` (schedule axes).

## URL builders in `@/lib/stationClient`

`coverUrl(subsonicId)` → the cover-art proxy URL for an `<img>`.
`resolveUrl(path)` → prefix a controller-relative path (persona avatars come
through as `/persona-avatar/...`). Empty input stays `''` so `<img>` fallbacks
keep working.
