# Final Chromium Rendering Debug Report

Date: 2026-08-07  
Branch: `feature/midnight-broadcast-flac`  
Implementation commit: `6649bd6` (`fix: contain schedule on mobile`)

## Result

The reported “missing/invisible text” was not a text color, opacity, font-loading, hydration, API-state, or JavaScript failure. The text was present, opaque, correctly colored, and visibly rasterized by Chromium. The misleading mobile full-page capture was widened from the requested 320 px viewport to 568 px by schedule overflow; screenshot viewers then fit/downscaled that oversized, mostly blank canvas, making the small UI text appear absent while large artwork and panel shapes remained obvious.

The weekly schedule intentionally contains a 560 px minimum-width table inside its own horizontal scroller. Its rounded `Panel` did not establish an overflow clip, so Chromium included that descendant overflow in the document/full-page screenshot bounds even though the visible panel itself was only 288 px wide.

## Root-cause evidence

### DOM and computed styles

A real headless Chromium run against `http://127.0.0.1:5210/` with `VITE_STATION_URL=https://radio.plexservernz.org` showed, before the fix:

- `document.body.innerText.length`: 8,202 characters.
- Live track heading existed in the DOM (`I’m Gonna Follow You`).
- Track heading computed `color`: `rgb(243, 245, 237)`.
- Track heading computed `opacity`: `1`.
- Body computed `color`: `rgb(243, 245, 237)`.
- Body computed `visibility`: `visible`.
- Body computed `-webkit-text-fill-color`: `rgb(243, 245, 237)`.
- CSS tokens resolved correctly (`--fg: #f3f5ed`, `--muted: #979b91`, `--signal: #c7f36b`).

This ruled out transparent text, unresolved color variables, global opacity/visibility, missing fonts, and absent React content.

### Layout/screenshot reproduction

At a 320 px Chromium viewport before the fix:

- `window.innerWidth`: 320 px.
- `document.documentElement.scrollWidth`: 568 px.
- Full-page PNG width: 568 px (not 320 px).
- The overflow offender was `Schedule`’s `.min-w-[560px]` content, extending to approximately x=589 px.
- The schedule scroller itself was 286 px client width with 584 px scroll width.
- A viewport-only 320 px capture visibly rendered the header, live metadata, title, controls, and supporting text, confirming that the apparent text loss was a full-page capture artifact.

A minimal runtime probe adding overflow clipping to the schedule panel reduced document width and the full-page PNG to 320 px while preserving the schedule scroller’s 584 px scroll width. Applying `overflow-x` to `html` alone changed the reported root width but did not change Chromium’s 568 px full-page capture, so the fix had to be at the leaking component boundary.

### Console/network evidence

Desktop and mobile verification runs had:

- No uncaught page errors.
- No failed requests.
- No application console errors or warnings (only Vite connection debug messages and React DevTools informational output).
- HTTP 200 responses for `/api/now-playing`, `/api/state`, `/api/session`, `/api/schedule`, cover artwork, and persona artwork.

This ruled out hydration, browser execution, CORS/API, and missing live-state explanations.

## Fix

Changed `src/components/Schedule.tsx`:

- Added `overflow-hidden` to the weekly schedule `Panel`.
- Kept the existing inner `overflow-auto` scroller unchanged.

This is a one-class, component-local containment fix. It prevents schedule overflow from widening the document/full-page screenshot while preserving intentional horizontal schedule navigation.

## Verification

### Red/green Chromium regression probe

The real-browser probe asserts DOM text/style, internal schedule scrolling, page errors, request failures, document width, and PNG width.

Before the source change (RED):

- `documentScrollWidth`: 568
- Full-page `screenshotWidth`: 568
- Failed: `schedule must not widen the document` (`568 !== 320`)

After the source change (GREEN):

- `documentScrollWidth`: 320
- Full-page `screenshotWidth`: 320
- Schedule remains internally scrollable: `clientWidth` 286, `scrollWidth` 584
- Heading remains opaque and foreground-colored
- No page errors or failed requests

Command: `node /tmp/midnight-pwdebug/render-regression.mjs`

### Project gates

- `npm run lint` — exit 0. One pre-existing non-blocking warning remains in `src/hooks/useStationFeed.tsx:104` (`react-refresh/only-export-components`); no errors.
- `npm run build` — exit 0; TypeScript and Vite production build succeeded (48 modules transformed).
- `git diff --check` — exit 0.

### Final Chromium captures

- Desktop full-page capture: 1440 × 1821; text visibly rendered across header, live hero, controls, booth, request, queue, schedule, and footer.
- Mobile full-page capture: 320 × 2888; no blank horizontal canvas, panels fit the viewport, text visibly rendered, and the schedule remains clipped to its panel with its own horizontal scroller.

Evidence files generated outside the repository:

- `/tmp/midnight-render-before/desktop.png`
- `/tmp/midnight-render-before/mobile.png` (568 px-wide failing capture)
- `/tmp/midnight-render-before/mobile-viewport.png`
- `/tmp/midnight-render-after/desktop.png`
- `/tmp/midnight-render-after/mobile.png` (320 px-wide passing capture)

## Changed files

- `src/components/Schedule.tsx`
- `.superpowers/sdd/2026-08-07-midnight-broadcast-flac/final-rendering-debug-report.md`
