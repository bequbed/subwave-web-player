# LONGWAVE — redesign proposal

*Proposal only. No files were changed.*

---

## 1. Concept

**LONGWAVE — printed matter for a station that never stops.**

Midnight Broadcast reads like a crypto dashboard: black glass, neon lime, glowing bento tiles. LONGWAVE goes the opposite way — **warm unbleached paper, ink-black type, one oxidized-terracotta accent, hairline rules instead of glowing cards.** The reference is a well-set music journal or a Blue Note liner note: editorial serif headlines, generous white space, near-square corners, no glow anywhere. Radio is the oldest broadcast medium; this direction treats the AI DJ as an editor with a print voice rather than a synthwave HUD. It is calm enough to leave open all day, and the single warm accent makes the *live* moment the only saturated thing on screen.

---

## 2. Color system

Foundation names change; **the alias layer keeps identical names, so no component needs a color edit.** Note `--ink` is aliased to `--bg` *and* used as on-accent text (`text-[var(--ink)]`, 3 sites) — in a light theme paper serves both roles, so keep `--ink` as a deprecated alias of `--paper`.

| Token | Value | Rationale | Contrast |
|---|---|---|---|
| `--paper` (`--bg`, `--ink`) | `#F4F0E9` | Unbleached stock, not white — warm, low glare, reads premium and prints-adjacent. Doubles as on-accent text. | base surface |
| `--leaf` (`--panel`) | `#FBF8F3` | Panels sit *lighter* than the page (inverted from dark mode) so surfaces feel like sheets laid on a desk. | 1.08:1 vs paper — intentionally near-invisible; borders do the separating |
| `--leaf-raised` (`--panel-2`) | `#EBE5DA` | Recessed tone for wells, chips, progress track, table zebra. The only "pushed-in" value. | 1.13:1 vs paper |
| `--graphite` (`--fg`) | `#17140F` | Warm near-black ink, never `#000` — pure black on warm paper looks like a bug. | **16.4:1** on paper; 17.6:1 on leaf |
| `--pencil` (`--muted`) | `#6B6459` | Warm grey-brown for metadata, timestamps, labels. Same family as the ink, desaturated. | **5.1:1** on paper — passes AA at 11px |
| `--rule` (`--line`) | `rgb(23 20 15 / 12%)` | Ink at 12%, so rules tint with the paper instead of going grey. Solid equivalent `#DCD6CB`. | non-text |
| `--ember` (`--signal`, `--accent`) | `#A63D1E` | Oxidized terracotta. The live/primary accent — warm, aged, zero neon. | **5.6:1** on paper; paper on ember **6.0:1** |
| `--tide` (`--atmosphere`, `--accent-2`) | `#17544C` | Deep petrol green for the secondary voice (requests, handoffs, DJ turns). Cool counterweight to ember. | **7.7:1** on paper |
| `color-scheme` | `light` | — | — |

Every text pairing clears WCAG AA; ink and tide clear AAA. Drop `body::before`'s radial glow mesh entirely — replace with a single 1200px top vignette at `rgb(23 20 15 / 3%)` for depth. Retire `.pulse-ring`'s lime shadow to `--ember` at 45%.

## 3. Type, radius, spacing, shadow

**Type — the biggest mood shift, zero new dependencies.** Display serif from the system stack: `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif` for track title, station name, panel headings. Body/UI stays the current sans stack. Scale: title `clamp(1.75rem, 4vw, 3rem)` / 1.05 / `-0.02em`; artist `1.125rem` sans, `--ember`; panel headings `0.6875rem` (11px) sans, `600`, `uppercase`, `tracking-[0.16em]`, `--pencil`; body `0.875rem`/1.55; fine print `0.6875rem` — **11px is the floor, the 9px and 10px classes in BoothFeed/Schedule/Panel go away**. All numerics `tabular-nums`.

**Radius.** Print is square. `4px` panels/cards, `2px` chips and schedule cells, `9999px` only for the live dot, avatars, and the volume thumb. Retire `rounded-3xl`, `rounded-[2rem]`, `rounded-[1.25rem]`.

**Spacing.** 4px base, 8px rhythm. Page `max-w-6xl` (down from 7xl) with `px-6 sm:px-10`, section gap `2.5rem`, panel padding `1.25rem`. Wider gutters, denser type — the premium signal is white space, not tiles.

**Shadow.** Almost none. Panels use `border border-[var(--rule)]` and no shadow. One elevation only, for the artwork plate and the sticky player rail: `0 1px 2px rgb(23 20 15 / 0.05), 0 12px 32px rgb(23 20 15 / 0.07)`. Delete every `shadow-2xl shadow-black/*` and the lime `shadow-[0_8px_24px_...]` on Send.

## 4. Layout evolution

The bento dissolves into an **editorial single-spine layout**. All eight components stay.

- **Masthead** — station name in display serif, thin rule beneath full width; right side holds `SignalDot` + listener count + on-air DJ (OnAir folds into the masthead on desktop, becoming a byline: avatar, persona, show, guests).
- **Hero** — two columns at `lg`: artwork plate (fixed 22rem) left, metadata right — title, artist, album·year, tag chips as underlined text links rather than filled pills. Elapsed rule sits directly under, spanning the metadata column.
- **Player rail** — no longer a card. A full-width rule-bounded bar directly beneath the hero, `position: sticky; bottom: 0` below `lg` so Tune In is always reachable on mobile. Tune In is the only filled ember element on the page.
- **Two columns below** (`lg:grid-cols-12`): **Booth** at 7 cols, restyled as a *transcript* — no rail, no per-kind tinted bubbles; speaker label in small caps, timestamp right-aligned in `--pencil`, ember/tide only as a 2px left border for request/handoff turns. **Request** (4-col) sits above **Queue** (4-col) in the side column — request first, since it's the only interactive thing.
- **Schedule** — full width, own section under both columns, still a semantic table with all 168 focusable cells; zebra `--leaf-raised`, live hour gets an ember fill + paper text (6.0:1) rather than a ring.
- **Footer** — hairline rule, 11px `--pencil` colophon.

Mobile: one column, listening-first, unchanged in order (hero → sticky rail → booth → request → queue → schedule).

## 5. Signature moments

1. **The plate.** Artwork is rendered as a physical print: an 8px `--leaf` mat, a 1px `--rule` frame, the single soft shadow, and *no* blurred backdrop. Off-air or missing cover → a letterpress placeholder, `--leaf-raised` with the station monogram debossed in `--rule`. This one detail carries the whole concept.
2. **The ticker rule.** Elapsed is a 2px hairline spanning the metadata column that fills left-to-right in `--ember`, with `mm:ss` in tabular numerals at each end — the visual language of a printed rule, not a scrubber. `cursor: default`, no pointer handlers, `role="img"` with an `aria-label`; it cannot be mistaken for a seek bar.
3. **The ON AIR stamp.** Overlaid at the plate's bottom-left on a paper chip: `ON AIR` in 11px small caps, `tracking-[0.2em]`, `--ember`, preceded by a 6px dot that breathes on a 2s ring. Under `prefers-reduced-motion` the animation stops and the dot keeps a static 2px ember ring — state stays legible without motion.

## 6. Constraints honored

- **No seek / no skip** — the ticker rule is non-interactive by construction (§5.2); no next/prev/rewind control is introduced anywhere, and `useMediaSession` stays unwired.
- **Gesture-gated playback** — Tune In remains a real `<button>` calling `tuneIn()` from a click; making it sticky on mobile *increases* the chance the gesture is available. No autoplay path added.
- **FLAC-first** — purely visual; `usePlayer`'s probe/fallback ladder and source-attempt tokens are untouched. The quality badge stays display-only, restyled as small-caps text in `--pencil` (`FLAC · lossless`).
- **Visible focus** — every existing `focus-visible` site keeps its ring, recolored `--signal` → ember on paper (5.6:1 against both `--paper` and `--leaf`); `ring-offset` becomes `--paper`. Schedule cells keep `focus-visible:z-20`.
- **Reduced motion** — the global `@media (prefers-reduced-motion: reduce)` block in `src/index.css` stays; the one new animation (§5.3) has an explicit static fallback.
- **≥11px floor** — the proposal *raises* the floor by removing the surviving `text-[9px]` / `text-[10px]` uses in BoothFeed, Queue, Schedule, and Panel.
- **Data/presentation separation** — changes are confined to `src/index.css` and `src/components/**`. No hook, `stationClient`, `types.ts`, or `config.ts` edit is required; no new field is invented, and all rendering stays optional-field tolerant (missing cover, null track with `ready: true`, absent genre/BPM).
- **No new dependencies** — system serif stack, CSS-only grain/vignette, existing keyframes. Tailwind v4 stays config-less; all values are utilities or `var(--token)` arbitrary values.

**Migration cost:** the token block is a drop-in rewrite; components then need a radius/shadow/type pass plus the three signature moments. Roughly one focused session, and the alias layer means the app is never broken mid-flight.
