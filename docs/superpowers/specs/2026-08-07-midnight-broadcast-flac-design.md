# Midnight Broadcast UI + FLAC Playback Design

## Goal

Turn Basement Transmission’s deployed SUB/WAVE web player into a polished, music-first “midnight broadcast” experience while preserving all existing live-radio behaviour. Add an automatic lossless FLAC preference with a reliable MP3 fallback; do not implement Opus.

## Context

The current player already has the correct data architecture: `src/lib/**` and `src/hooks/**` own station access, polling, requests, metadata, Media Session integration, and the single audio element. `src/components/**`, `src/App.tsx`, and `src/index.css` are presentation-focused and are the intended redesign surface.

The station at `https://radio.plexservernz.org` currently exposes both `/stream.mp3` and `/stream.flac`. The FLAC mount responds successfully and identifies its broadcast as lossless. The player must treat FLAC as a preference, never as a requirement: browser codec support differs, so every unsupported or failed FLAC attempt must fall back to the universal MP3 mount without requiring another click.

## Visual Direction

### Theme and typography

- Use a deep blue-black base, layered graphite surfaces, restrained borders, and elevated cards instead of the generic default cyan/purple look.
- Use a bright chartreuse/lime signal colour exclusively for live state, transport controls, progress, and focused actions. Use a muted violet/blue as a secondary atmospheric accent.
- Use an editorial type hierarchy: track title is the primary visual anchor; artist is secondary; album/year and acoustic tags are compact supporting information.
- Add a very subtle radial/mesh illumination behind the main content. It must be cosmetic, low contrast, and disabled or static for reduced-motion users.

### Layout

- Keep one responsive page with no client-side routing.
- On desktop, combine Now Playing and transport into a hero card. Place artwork prominently beside current-song metadata, live status, the main Tune In/Pause control, quality, and live station vitals.
- Place Booth, Request a Track, On the Deck, and Weekly Schedule in a deliberate bento grid below the hero. Booth remains the largest secondary panel.
- On mobile, prioritize listening: identity bar, artwork/current track, transport/quality, then the supporting panels in a single readable column.
- Preserve all existing content, including the station host, DJ/show identity, queue/history, schedule, request result states, connectivity state, and off-air/loading states.

### Component treatment

- Station header: make Basement Transmission a clear station identity, with a compact live-signal treatment and DJ/show context rather than a reference-template header.
- Now Playing: make cover art larger with a restrained image-derived glow; replace the generic chip treatment with quieter signal tags; retain the non-interactive approximate elapsed indicator.
- Player controls: use one obvious circular Tune In/Pause control with clear buffering, playing, and paused states. Present stream quality as a readable quality badge, not an opaque internal metric.
- Booth: restyle as a readable activity timeline. Keep all existing session messages and labels, but visually distinguish speech, tracks, and handoffs.
- Requests: foreground the request input; provide prominent, calm pending/success/failure feedback.
- Queue and schedule: make “Up next” visually stronger than history; highlight the current schedule slot and retain horizontal scrolling for its time grid on narrow displays.

## FLAC Playback Behaviour

### Stream selection

1. `src/config.ts` exposes both `mp3StreamUrl` and `flacStreamUrl` derived from the one `VITE_STATION_URL` origin. The application does not add `VITE_*` configuration beyond the existing station URL.
2. `usePlayer` probes browser support before selecting a stream. Because the live FLAC endpoint currently uses an Ogg-family response type, it tests both `audio/flac` and `audio/ogg; codecs="flac"`.
3. A browser reporting usable FLAC support starts playback from `/stream.flac`; all other browsers start `/stream.mp3`.
4. If FLAC playback raises an audio error before successful playback, `usePlayer` retries the same gesture attempt once on `/stream.mp3`. It must guard this retry so a broken network connection cannot cause an infinite retry loop.
5. When the user pauses and tunes in again, the hook reselects the live edge and repeats the appropriate quality choice, preserving the existing live-radio semantics.

### Quality UI

- The player exposes a simple quality state: `FLAC` when lossless playback is in use, or `MP3 · <bitrate> kbps` when MP3 is in use.
- Quality is informational. The listener does not receive a codec toggle in this pass, avoiding a control that may not be usable on their browser.
- If a FLAC-capable attempt falls back to MP3, display the MP3 quality once playback succeeds; do not show an error toast for a seamless compatibility fallback.

## Accessibility and interaction requirements

- Preserve semantic buttons, labels, and keyboard operability for transport, mute, volume, and request submission.
- Use visible focus styles and maintain readable contrast in every state.
- Respect `prefers-reduced-motion` by disabling equalizer, pulse, and decorative transitions while retaining state visibility.
- Never introduce seek, next, previous, shuffle, or per-listener queue controls. The station remains one shared live broadcast.

## Scope boundaries

Included:

- Dark modern visual redesign of the existing player components and responsive layout.
- FLAC-first playback selection with MP3 fallback.
- Production build, lint/type-check, browser verification, and Cloudflare Worker deployment verification.

Excluded:

- Opus support.
- PWA/offline support, themes fetched from the station, analytics beacons, authentication, favourites, or persistent history.
- Changes to SUB/WAVE server, Cloudflare Tunnel, API endpoints, or `VITE_STATION_URL` deployment configuration.
- New third-party UI or icon dependencies.

## Verification criteria

1. `npm run lint` and `npm run build` pass.
2. On a FLAC-capable desktop browser, Tune In plays `/stream.flac` and the UI identifies the stream as FLAC.
3. When FLAC support is unavailable or the FLAC play attempt errors, Tune In automatically plays `/stream.mp3` and shows MP3 quality.
4. The deployed Worker continues to display live metadata, artwork, Booth messages, schedule, queue/history, and request outcomes from `radio.plexservernz.org`.
5. Desktop and narrow mobile viewport checks confirm that controls are reachable and no panel content overlaps or becomes unreadable.
