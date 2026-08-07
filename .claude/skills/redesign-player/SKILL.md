---
name: redesign-player
description: >-
  Redesign the look and feel of this SUB/WAVE web player — a new visual design,
  skin, theme, layout, or a ground-up rebuild of the UI — while keeping the data
  and audio plumbing intact. Use this WHENEVER the user wants to restyle,
  reskin, retheme, redesign, or "make this player their own", change the layout,
  build a different player face, adjust colors/typography/spacing, or rebuild
  any of the on-screen components, even if they don't say the word "redesign".
  This player is built to be gutted and restyled; this skill keeps the redesign
  from accidentally breaking the live-radio data flow.
---

# Redesigning this player

This repo is a **reference SUB/WAVE web player** built for exactly this: keep the
plumbing, replace the face. Your job is to help the user reshape the UI without
breaking the live-radio data flow underneath.

## The one idea that makes this safe

The codebase is split in two, on purpose:

- **Data layer — leave it alone** (`src/config.ts`, `src/lib/**`, `src/hooks/**`).
  It fetches the station, owns the `<audio>` element, and exposes everything
  through hooks. You almost never edit these when redesigning.
- **Presentation — this is your canvas** (`src/components/**`). Every component
  reads its data from the hooks and renders it. Rewrite these freely.

As long as your new UI consumes the same hooks, the plumbing keeps working. So
the redesign workflow is: **read the hooks contract, then rebuild components
against it.** Don't reach into `src/lib` or re-implement fetching/audio — the
data is already handed to you.

Read `references/hooks-api.md` for the exact data each hook returns. That file is
the contract you're designing against — skim it before writing components so you
know what's available (cover art, tags, listener count, DJ persona, session
feed, queue, schedule, request status) and don't invent fields that aren't there.

## Live-radio constraints (don't design these away)

This is one shared stream, not a personal playlist. The UI must respect that:

- **No seek bar you can scrub, no skip/next/previous button.** Everyone hears the
  same thing. The progress bar is a read-only clock (and it's approximate — see
  the hooks reference). A "skip" control would be misleading; don't add one.
- **Playback starts on a tap.** Browsers block autoplay, so the first play must
  come from a user gesture. Keep a visible "tune in" / play affordance;
  `usePlayer().tuneIn()` must be called from a click/tap handler.
- **The station can be off air.** `useStationFeed()` can return a null track with
  `ready: true` — design an empty/off-air state, don't assume a track is always
  present.
- **Fields are optional.** A freshly-added track has no genre/BPM/mood yet; a
  jingle has no cover. Render what's there, omit what isn't — never show
  "undefined".

## Workflow

1. **Understand the current shape.** Skim `src/App.tsx` (the layout + how the
   provider and player are wired) and one or two components (e.g.
   `src/components/NowPlaying.tsx`) to see the house style. Read
   `references/hooks-api.md`.
2. **Agree on the direction.** If the user hasn't described a concrete look,
   pin it down first — mood, color, density, inspiration. A redesign without a
   point of view lands as "generic". If you have a `frontend-design` skill
   available, this is a good moment to use it for aesthetic direction.
3. **Keep the wiring, change the render.** In `src/App.tsx`, preserve the
   `<StationFeedProvider>` wrapper and the `usePlayer()` + `useMediaSession()`
   calls in `PlayerView` — that's the plumbing. Rearrange and restyle what it
   renders. For a bigger departure, you can replace the components wholesale as
   long as the new ones read from the same hooks.
4. **Retint globally first.** The fastest big win is the theme tokens at the top
   of `src/index.css` (`--bg`, `--panel`, `--accent`, `--fg`, `--muted`,
   `--line`, …). Components reference them via Tailwind arbitrary values
   (`bg-[var(--bg)]`), so changing a few variables restyles everything at once.
   Prefer extending this token set over hardcoding colors in components — it
   keeps the next redesign easy too.
5. **Style with Tailwind v4.** There is **no `tailwind.config.js`** (v4 is
   config-less; the import lives in `src/index.css`). Use utility classes and
   `var(--token)` arbitrary values. Co-locate any keyframes/custom CSS in
   `src/index.css`.
6. **Verify.** Run `npm run lint` (this is `eslint . && tsc -b` — a real
   type-check) and `npm run dev`, then look at the player against the live
   station. The default station plays real radio with zero config, so you can
   see cover art, tags, the booth feed, and the schedule populate immediately.
   Note: a single benign `react-refresh/only-export-components` warning in
   `src/hooks/useStationFeed.tsx` is pre-existing (the provider and its hook are
   co-located there on purpose) — don't mistake it for something your redesign
   broke.

## What not to touch (unless the user asks for new data)

- `src/lib/stationClient.ts` — the only fetcher. Touch it only to add a *new*
  endpoint (that's the `connect-station` / feature-adding path, not restyling).
- The 5s poll loop and hidden-tab pause in `useStationFeed` — battle-tested;
  redesigning shouldn't need to change how data arrives.
- The audio gesture gate and "no skip" MediaSession wiring in `usePlayer` /
  `useMediaSession` — these encode the live-radio rules above.

If a redesign genuinely needs a piece of data the hooks don't expose yet, add it
at the source (types → stationClient → hook) rather than fetching inside a
component — that's what keeps the data/presentation split intact.
