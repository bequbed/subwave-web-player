# Midnight Broadcast FLAC Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a responsive Midnight Broadcast visual redesign for Basement Transmission and make playback prefer FLAC with one automatic MP3 fallback.

**Architecture:** Keep the existing SUB/WAVE data layer and live-radio semantics intact. Add stream URL/quality selection to `config.ts` and `usePlayer`, then replace only the presentation composition, visual tokens, and existing components. The player owns the final quality state so UI components render it without querying the browser or station directly.

**Tech Stack:** React 19, TypeScript 5, Vite 6, Tailwind CSS v4, browser HTMLAudioElement and Media Session APIs.

## Global Constraints

- Preserve the one shared live stream: no seek, skip, previous, shuffle, or listener-managed queue.
- Playback must still begin only from a user gesture and must reload the live edge on each tune-in.
- Prefer `/stream.flac` only when the browser reports FLAC support; retry `/stream.mp3` once if FLAC fails before playback starts.
- Do not implement Opus or add dependencies.
- Keep controller calls in `src/lib/stationClient.ts` and polling in the existing hooks; presentation components must not call `fetch`.
- Keep `VITE_STATION_URL` as the only deployment configuration value.
- Respect reduced motion and maintain keyboard focus and readable contrast.
- Quality gates are `npm run lint` and `npm run build`; this repository has no automated test runner.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/config.ts` | Derive MP3 and FLAC stream URLs from one station origin. |
| `src/hooks/usePlayer.ts` | Select stream format, perform one guarded fallback, and expose the active quality to the UI. |
| `src/App.tsx` | Compose the station identity, hero, and responsive bento layout. |
| `src/index.css` | Define Midnight Broadcast tokens, base styling, reduced-motion behavior, and reusable visual utilities. |
| `src/components/NowPlaying.tsx` | Render the current-song artwork and editorial metadata portion of the hero. |
| `src/components/PlayerBar.tsx` | Render primary transport and quality/vital controls within the hero. |
| `src/components/OnAir.tsx` | Render compact DJ/show identity suited to the new header. |
| `src/components/BoothFeed.tsx` | Render the DJ session as a readable categorized timeline. |
| `src/components/RequestBox.tsx` | Render request input and result feedback with the new visual system. |
| `src/components/Queue.tsx` | Emphasize upcoming tracks and de-emphasize history. |
| `src/components/Schedule.tsx` | Improve current-slot visibility and narrow-screen grid behavior. |
| `src/components/ui/Panel.tsx` | Provide a shared elevated panel shell for all secondary sections. |
| `docs/superpowers/specs/2026-08-07-midnight-broadcast-flac-design.md` | Approved design contract; do not alter without a design change. |

## Task 1: Add lossless stream selection and safe fallback

**Files:**
- Modify: `src/config.ts:15-24`
- Modify: `src/hooks/usePlayer.ts:13-118`

**Interfaces:**
- Produces `config.mp3StreamUrl: string` and `config.flacStreamUrl: string`.
- Extends `Player` with `quality: 'flac' | 'mp3' | null`.
- `PlayerBar` consumes `player.quality` in Task 3.

- [ ] **Step 1: Replace the single stream URL with explicit MP3 and FLAC URLs.**

```ts
mp3StreamUrl: `${STATION_URL}/stream.mp3`,
flacStreamUrl: `${STATION_URL}/stream.flac`,
```

Keep `stationUrl`, `apiUrl`, and `pollIntervalMs` unchanged. Remove the old `streamUrl` field so all stream consumers use an explicit format.

- [ ] **Step 2: Add an FLAC capability helper inside `usePlayer.ts`.**

```ts
function canPlayFlac(el: HTMLAudioElement): boolean {
  return ['audio/flac', 'audio/ogg; codecs="flac"'].some(
    (type) => el.canPlayType(type) === 'probably' || el.canPlayType(type) === 'maybe',
  );
}
```

The station’s lossless mount is Ogg-family, so test both MIME descriptions. Do not probe or add an Opus type.

- [ ] **Step 3: Track active quality and source selection.**

Add `quality` state and refs for the preferred format plus a `fallbackAttemptedRef`. On each new `play()` call, clear the fallback ref, choose FLAC only when `canPlayFlac(el)` is true, set `el.src` with the existing cache-busting timestamp, and set `quality` to the selected format before calling `el.play()`.

- [ ] **Step 4: Implement a single FLAC-to-MP3 error fallback.**

In the audio `error` handler, if the active quality is `flac` and the fallback ref is false, set the ref true, switch `el.src` to `config.mp3StreamUrl` with a new timestamp, set `quality` to `mp3`, and call `el.play()`. For all other errors, preserve the existing stopped/loading-false behavior. The guard must prevent repeat retries.

- [ ] **Step 5: Reset player state consistently when stopped.**

`stop()` must still pause, clear `src`, set `playing`/`loading` false, and set `quality` to `null`. Return `quality` from `usePlayer` with the existing Player fields.

- [ ] **Step 6: Run static quality gates.**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit.**

```bash
git add src/config.ts src/hooks/usePlayer.ts
git commit -m "feat: prefer FLAC stream with MP3 fallback"
```

## Task 2: Establish the Midnight Broadcast design foundation and layout

**Files:**
- Modify: `src/index.css:1-88`
- Modify: `src/App.tsx:1-103`
- Modify: `src/components/ui/Panel.tsx:1-33`
- Modify: `src/components/OnAir.tsx:1-63`

**Interfaces:**
- Consumes existing `useStationFeed()` values and all existing section components.
- Produces the desktop/mobile layout containers and shared panel surface consumed by Tasks 3–5.

- [ ] **Step 1: Replace generic theme tokens with Midnight Broadcast tokens.**

Define deep ink backgrounds, elevated surfaces, soft border values, high-contrast foreground, muted metadata, a lime `--signal`, and a violet `--atmosphere`. Retain `--bg`, `--panel`, `--panel-2`, `--fg`, `--muted`, `--line`, `--accent`, and `--accent-2` aliases so existing components remain type-safe during staged styling.

- [ ] **Step 2: Add global background and motion-safe utility styling.**

Create a `body::before` fixed radial-gradient/mesh layer with `pointer-events: none` and low opacity. Add `@media (prefers-reduced-motion: reduce)` that forces animation and transition duration to near-zero. Keep `.scroll-thin` behavior and ensure its thumb uses the updated border token.

- [ ] **Step 3: Refactor `App.tsx` around identity, hero, and bento sections.**

Keep `StationFeedProvider`, `usePlayer`, and `useMediaSession` exactly once. Use a max-width container, a compact header with station name/host, `OnAir`, and `SignalDot`; introduce semantic wrappers named `main`, `section`, and `aside` rather than generic clickable divs. Place the hero first and use a responsive CSS grid where Booth has the widest desktop span.

- [ ] **Step 4: Redesign the shared `Panel` shell.**

Keep the existing props (`title`, `aside`, `children`, `className`) unchanged. Give every secondary panel a slightly translucent elevated surface, a compact title row, a consistent panel label treatment, and focus-within border emphasis. Do not make panel headers interactive.

- [ ] **Step 5: Compact the On Air presentation.**

Keep the existing DJ, show, tagline, guests, and avatar fallback data. Restyle the on-air badge with the signal token and reduce visual competition with the station identity. Preserve alt text and the current show fallback behavior.

- [ ] **Step 6: Run static quality gates.**

```bash
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit.**

```bash
git add src/index.css src/App.tsx src/components/ui/Panel.tsx src/components/OnAir.tsx
git commit -m "feat: add midnight broadcast layout foundation"
```

## Task 3: Build the now-playing hero and quality-aware controls

**Files:**
- Modify: `src/components/NowPlaying.tsx:1-121`
- Modify: `src/components/PlayerBar.tsx:1-121`

**Interfaces:**
- Consumes `Player.quality`, `Player.playing`, `Player.loading`, and the existing station feed.
- Does not change `NowPlaying`’s `playing` prop or its `useElapsed()` integration.

- [ ] **Step 1: Restyle Now Playing as editorial hero content.**

Keep cover loading/fallback, tag generation, and the client-side progress calculation. Use a large square artwork block with a restrained blurred color backdrop derived from `gradientFor(key)`, an overlaid live indicator only while playing, and more pronounced title/artist typography. Keep the elapsed bar non-interactive and label its right endpoint `live` when duration is unavailable.

- [ ] **Step 2: Reduce tag noise without removing metadata.**

Continue displaying at most six existing genre/BPM/key/energy/mood values. Restyle them as small low-contrast signal labels. Do not invent tags or change the `tagChips()` data order.

- [ ] **Step 3: Add a quality badge to PlayerBar.**

Render `FLAC · lossless` if `player.quality === 'flac'`; render `MP3 · ${bitrate ?? 'live'} kbps` if it is `mp3`; render `Selecting quality…` only while a tune-in attempt is loading with no selected quality. It is display-only; no format-selection button is added.

- [ ] **Step 4: Make the primary transport dominant but accessible.**

Preserve `toggle`, loading spinner, aria labels, mute button, and volume slider. Use a single prominent rounded Tune In/Pause button with focus-visible ring, active press feedback, and a textual state adjacent to it. Keep station vitals visible but visually secondary.

- [ ] **Step 5: Run static quality gates.**

```bash
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit.**

```bash
git add src/components/NowPlaying.tsx src/components/PlayerBar.tsx
git commit -m "feat: redesign live listening hero"
```

## Task 4: Restyle live-radio supporting panels

**Files:**
- Modify: `src/components/BoothFeed.tsx:1-84`
- Modify: `src/components/RequestBox.tsx:1-108`
- Modify: `src/components/Queue.tsx:1-85`
- Modify: `src/components/Schedule.tsx:1-126`

**Interfaces:**
- Keeps existing hooks and their return types unchanged.
- Keeps Booth auto-scroll, request polling/result states, queue limits, and station-local schedule calculation unchanged.

- [ ] **Step 1: Turn The Booth into a categorized timeline.**

Keep `KIND_LABEL`, `turnLabel`, filtering, and auto-scroll unchanged. Add a subtle vertical timeline rail and give each label a semantic visual variant using its known kind (`play`, `handoff`, `request`, or other). Preserve the message text and timestamp exactly as supplied.

- [ ] **Step 2: Make request submission input-first.**

Keep form fields, character limits, disabled/busy behavior, `submit`, and `reset`. Improve input contrast and focus rings, give Send a signal-colour primary style, and visually differentiate pending, resolved, failed, and unknown cards without changing their messages.

- [ ] **Step 3: Prioritize upcoming tracks in Queue.**

Keep the existing `slice(0, 4)` upcoming and `slice(0, 12)` history limits. Give upcoming entries stronger text, a small ordinal or signal marker, and more breathing room. Keep recently played intentionally subdued and preserve request attribution/time data.

- [ ] **Step 4: Clarify the current schedule slot.**

Keep `nowInZone`, time axis, horizontal overflow, titles, and legend data. Style the current hour with a lime outline/fill treatment, make empty slots visibly quieter, and make show colours legible against the new panel background. Do not change the station timezone logic.

- [ ] **Step 5: Run static quality gates.**

```bash
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit.**

```bash
git add src/components/BoothFeed.tsx src/components/RequestBox.tsx src/components/Queue.tsx src/components/Schedule.tsx
git commit -m "feat: modernize station supporting panels"
```

## Task 5: Verify the actual radio experience and production deployment

**Files:**
- Modify only if a verified defect from the checks below requires it.

**Interfaces:**
- Verifies the public Cloudflare Worker at `https://subwave-web-player.bequbed.workers.dev/` against station origin `https://radio.plexservernz.org`.

- [ ] **Step 1: Install locked dependencies in the isolated worktree.**

```bash
npm ci
```

Expected: dependency install completes without changing `package-lock.json`.

- [ ] **Step 2: Run the complete local quality gate.**

```bash
npm run lint
npm run build
```

Expected: both commands exit 0 and `dist/` is produced.

- [ ] **Step 3: Run the built application locally.**

```bash
VITE_STATION_URL=https://radio.plexservernz.org npm run dev -- --host 127.0.0.1
```

Check at a desktop width and a 390 px mobile width: no overlap, legible panel text, reachable Tune In/volume/request controls, and a horizontally scrollable schedule.

- [ ] **Step 4: Validate FLAC and fallback playback in browser tools.**

On a browser that reports FLAC support, click Tune In and confirm the audio request includes `/stream.flac` and the quality badge reads `FLAC · lossless`. In a separate browser context where FLAC support is unavailable or by temporarily simulating an FLAC `error` event during a local manual check, confirm it makes one `/stream.mp3` request, plays without another click, and displays an MP3 badge. Confirm no retry loop occurs.

- [ ] **Step 5: Push the feature branch and deploy through the existing Cloudflare Git integration.**

```bash
git push -u origin feature/midnight-broadcast-flac
```

Open or merge the branch using the repository’s normal GitHub workflow so the connected Cloudflare Worker receives the production build. Do not change `VITE_STATION_URL`.

- [ ] **Step 6: Verify the production Worker.**

Open `https://subwave-web-player.bequbed.workers.dev/`, confirm live metadata uses Basement Transmission, click Tune In, verify playback and the expected quality indicator, and check desktop and narrow mobile layouts.

- [ ] **Step 7: Commit any verification-driven fix separately.**

```bash
git add <verified-fix-files>
git commit -m "fix: resolve production player verification issue"
```

Only make this commit if a reproducible verification failure was fixed.

## Plan self-review

- Spec coverage: Tasks 1–4 map to every approved visual and FLAC requirement; Task 5 covers local and deployed verification.
- Scope: no API/server, Cloudflare tunnel, Opus, PWA, authentication, analytics, dependency, or playback-control expansion is included.
- Interface consistency: `Player.quality` is produced in Task 1 and consumed only in Task 3; existing hook/component public inputs remain intact.
- No placeholders: every task names exact files, interfaces, commands, expected outcomes, and commit boundaries.
