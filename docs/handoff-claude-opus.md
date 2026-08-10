# Handoff to Claude Opus — SubWave Web Player

> Written 2026-08-10 for a fresh Claude Code session (`claude --model opus`) in this repo.
> You are inheriting a live, deployed product. Read this first, then `CLAUDE.md`, then explore.

## 1. What this is

A React 19 + Vite 6 + TypeScript + Tailwind v4 web player for a self-hosted SUB/WAVE
internet radio station (AI DJ, one shared Icecast stream). It is **live in production**:

- **Player (Cloudflare Worker):** https://subwave-web-player.bequbed.workers.dev/
- **Station (self-hosted, NZ):** https://radio.plexservernz.org (API + streams)
- **Repo:** github.com/bequbed/subwave-web-player (this directory, `main`)

The station is a multi-station server (stations: `main`, `open-frequency`). The player
points at **main** only. Station state lives on the server at
`/opt/subwave/state/stations/<station>/` (root-owned, live — do not edit carelessly;
the admin UI and Liquidsoap watchers own those files).

## 2. Current state — "Midnight Broadcast" redesign (shipped 2026-08-07)

A full premium dark redesign was implemented, independently reviewed task-by-task,
and deployed. All work is on `main` (clean, pushed). What's live now:

- **Visual system:** near-black/navy layered background with radial glow mesh;
  electric-lime signal accent `#c7f36b`; restrained violet atmosphere `#9d8cff`.
  Tokens live at the top of `src/index.css` (`--bg`, `--panel`, `--signal`, …);
  components consume them via Tailwind arbitrary values (`bg-[var(--signal)]`).
- **Layout:** desktop bento grid — hero (NowPlaying + PlayerBar), Booth 8-col,
  Request 4-col, Queue 4-col, Schedule 8-col; single listening-first column on mobile.
- **Now Playing hero:** large square artwork with blurred backdrop, Live overlay
  badge, strong title hierarchy, album/year, acoustic tag chips (6 max, original
  order preserved), client-side elapsed bar (display-only, no seek).
- **PlayerBar:** dominant Tune In/Play control, buffering/on-air/paused status text,
  mute + volume + listener/bitrate/token vitals, display-only quality badge
  (`FLAC · lossless` / `MP3 · 320 kbps` / `Selecting quality…`).
- **Booth feed:** railed timeline with per-kind markers (play/handoff/request).
- **Request box:** lime primary Send, mobile-stacked, pending/resolved/failed cards.
- **Queue:** numbered upcoming cards, subdued recently-played rows.
- **Schedule:** semantic `<table>` (168 keyboard-focusable slots, `aria-current="time"`
  on live hour), contained horizontal scroller, legend (8 shows max).
- **Playback (Task 1, the hard one):** FLAC-first with single automatic MP3 fallback.
  `usePlayer` probes `canPlayType('audio/flac')` + `audio/ogg; codecs="flac"`, streams
  `/stream.flac`, and on a pre-playback error retries `/stream.mp3` **exactly once**.
  Includes monotonic source-attempt tokens + `currentSrc === assignedSourceRef` guards
  so stale async rejections / queued errors from superseded sources can't corrupt the
  active attempt. No Opus, no AAC, no codec toggle, no seek/skip.
- **Accessibility:** visible focus rings, associated form labels, live-region status
  announcements, reduced-motion support, ≥11px text floor, validated at 320px +
  200% zoom in real Chromium (Playwright). One known lint warning remains:
  `src/hooks/useStationFeed.tsx:104` (`react-refresh/only-export-components`) — pre-existing.

## 3. Architecture — the load-bearing idea (preserve this)

**Strict data/presentation separation.**

- **Data layer (keep):** `src/config.ts` (single `VITE_STATION_URL` → api/stream
  URLs), `src/lib/stationClient.ts` (the ONLY module that fetches the controller;
  every controller-relative URL built here), `src/lib/types.ts`, `src/hooks/**`
  (one 5s poll loop `useStationFeed` context provider; `usePlayer` owns the single
  `<audio>`; `useElapsed`, `useRequest`, `useSchedule`, `useMediaSession`).
- **Presentation (free to redesign):** `src/components/**` — read everything via
  hooks + stationClient, never `fetch` directly in a component.
- Endpoints consumed: `/now-playing`, `/state`, `/session`, `/schedule`,
  `POST /request` + `/request/:id` (poll every 2s), `/cover/:id`, `/health`,
  `/stream.mp3` (always-on), `/stream.flac` (enabled). All unauthenticated, CORS `*`.

## 4. Tooling / verification / deploy

```bash
npm run lint    # eslint . && tsc -b  ← tsc -b is the REAL type-check; tsc --noEmit checks nothing
npm run build   # tsc -b && vite build
npm run dev     # Vite + HMR
```
No test runner exists. Lint+build are the gates. Browser verification is done with
Playwright Chromium (`npx playwright@1.55.0 screenshot …`).

**Deploy:** push to `main` → Cloudflare Workers Git integration builds and deploys
(production build var `VITE_STATION_URL=https://radio.plexservernz.org` is set in
Cloudflare). New bundle hashes confirm a deploy (`assets/index-*.js` in the served
HTML). Station health: `curl https://radio.plexservernz.org/api/health` → on-air.

## 5. Constraints (non-negotiable, from the product)

- **Live radio semantics:** one shared stream, no per-listener shuffle, **no seek,
  no skip, no rewind**. `useMediaSession` deliberately leaves next/prev/seek unwired.
- Playback starts **only from a user gesture** (Tune In). Paused live streams go
  stale → always re-point at the live edge on play (cache-busting query param).
- FLAC is the user's preferred codec. No codec-selection toggle; show actual quality.
- Tailwind v4 is config-less (`@import "tailwindcss"` in `src/index.css`), no
  `tailwind.config.js`. Path alias `@/*` → `src/*`.
- Don't add third-party UI/icon dependencies without a strong reason (currently
  zero runtime deps beyond react/react-dom).

## 6. Open opportunities (ranked by user value)

1. **Opus stream.** Station-side knob exists: `liquidsoap_opus_enabled.txt=false`,
   `liquidsoap_opus_bitrate.txt=320` under `stations/main/`; `/stream.opus` currently
   404s. Enabling = flip knob on server + restart broadcast, then player-side:
   probe `canPlayType('audio/ogg; codecs=opus')`, extend the FLAC→MP3 ladder (suggested
   FLAC → Opus → MP3), extend quality badge. NOTE: user said "i dont need opus" re:
   codec earlier — confirm intent before prioritizing this one.
2. **PWA install** (manifest, icons, offline shell) — the README's flagship gap.
3. **Theme/skin engine** — `/themes` endpoint + `ui.skin` on `/state` already exist
   station-side; player ignores them.
4. **Audience beacon** — fire-and-forget `POST /beacon` (analytics).
5. **Community catalogs** — `/personas/community`, `/skills/community`,
   `/shows/community` exist but unused.
6. **Second station** — player could optionally target `open-frequency` (pure-DJ,
   persona "Gargoyle") — config surface is only `VITE_STATION_URL` today.

## 7. Working style expectations (owner's standard)

- Plan → implement → independent review → fix validated findings → fresh real
  verification → only then deploy. Every prior task went through this loop.
- Visual changes must include responsive/mobile checks (320px, zoom), not just
  compile-only validation.
- Keep diffs scoped; no drive-by refactors. Preserve the data-layer separation.
- Report honestly; never fabricate test results.
