# SUB/WAVE Web Player

A lean, forkable reference web player for a [SUB/WAVE](https://github.com/perminder-klair/subwave)
internet radio station — **React + Vite + TypeScript + Tailwind**.

📖 **[Guide & API docs → getsubwave.github.io/web-player](https://getsubwave.github.io/web-player/)**

It ships pointed at the live public station, so it plays real radio the moment
you run it. It's built to be **cloned and redesigned**: the data layer (API
client + hooks) is cleanly separated from the presentation (components), so you
can keep the plumbing and rebuild the look however you like.

> SUB/WAVE is *radio*, not a playlist — one shared Icecast stream, an AI DJ
> picking tracks and talking between them. Everyone hears the same thing at the
> same time. There's no per-listener shuffle and no skip button, and this
> player reflects that.

## Quick start

```bash
npm install
npm run dev        # → http://localhost:5173 (plays the live public station)
```

That's it — no config needed. `npm run build` produces a static `dist/` you can
host anywhere.

## Quick start using agents

Would rather just *describe* the player you want and let a coding agent build it?
This repo is set up for exactly that. It ships with an `AGENTS.md` and built-in
skills, so agents like Claude Code and Cursor already understand how the player
is wired — you describe the vibe, they do the code. No experience required.

**1. Get the repo to your agent.** Clone it and open the folder in your coding
agent:

```bash
git clone https://github.com/getsubwave/web-player.git && cd web-player
```

(or just paste the repo URL and ask the agent to clone it for you.)

**2. Describe the look you want.** Talk to it like a designer, not a programmer —
for example:

> "Restyle this player like a warm 70s vinyl setup — cream, burnt orange and
> brown, chunky rounded panels, a serif logo."

> "Make it minimal black-and-white brutalist — monospace font, hard edges, no
> shadows."

> "Neon synthwave: dark blue, glowing pink and cyan accents, a subtle grid glow
> behind the cover art."

The player's `redesign-player` skill kicks in on its own and keeps the audio and
live data working while it changes the look. Want your own station instead of the
public one? Just say so:

> "Point this player at my station at https://radio.mysite.com"

**3. See it, then ship it.** Ask the agent to run and deploy it:

> "Run it so I can see it." → it starts the dev server and gives you a link.
>
> "Deploy it to Vercel." (or Netlify, or "put it in Docker and run it")

Then keep going in plain English — *"make the accent pinker"*, *"bigger cover
art"*, *"move the request box to the top"*. Iterate until it's yours; you never
have to open the code.

## Deploy

It's a static single-page app (`vite build` → `dist/`), so it deploys to any
static host in one click. These buttons clone this repo and auto-detect the Vite
build:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/getsubwave/web-player)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/getsubwave/web-player)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/getsubwave/web-player)

> The buttons pull from a **public GitHub repo** — update the URLs above to point
> at your own fork (they assume `github.com/getsubwave/web-player`).

**Build settings** (auto-detected by the above; enter manually on other hosts):

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20+ |

**Docker.** A multi-stage `Dockerfile` builds the site and serves `dist/` with
nginx; `docker-compose.yml` wraps it:

```bash
docker compose up -d --build       # → http://localhost:8080

# tune the image at a specific station + port:
VITE_STATION_URL=https://radio.example.com PORT=3000 docker compose up -d --build
```

Or without compose:

```bash
docker build -t subwave-player --build-arg VITE_STATION_URL=https://www.getsubwave.com .
docker run -p 8080:80 subwave-player
```

Because `VITE_STATION_URL` is baked in at build time, changing the station means
a rebuild (`--build`), not just a restart.

**Railway / Render / Fly / any container host.** Point them at the `Dockerfile`
above (Railway/Render both auto-detect it) and set `VITE_STATION_URL` as a build
arg / env var. Prefer a static host? Build with `npm run build` and serve `dist/`
— e.g. `npx serve -s dist -l $PORT`.

**Pointing a deployment at a specific station.** `VITE_STATION_URL` is inlined at
**build time** (all Vite `VITE_*` vars are), not read at runtime. To ship a build
locked to your own station, set `VITE_STATION_URL` in the platform's environment
variables and redeploy — a rebuild bakes it in. Left unset, the deployment tunes
into the public station.

## Point it at your own station

Every SUB/WAVE deployment serves the same routes on one hostname, so a single
origin URL is all the player needs. Copy `.env.example` to `.env` and set:

```bash
VITE_STATION_URL=http://localhost:7700      # your local install
# VITE_STATION_URL=https://radio.example.com
```

From that origin the player derives `${url}/api` (the controller) and
`${url}/stream.mp3` (the audio). It works cross-origin out of the box — the
controller's CORS and the Icecast mount are both wide open.

## What it shows

| Feature | Source |
| --- | --- |
| Now playing — cover art, title/artist/album, and the acoustic-tag strip (genre · BPM · key · mood · energy) | `/now-playing` |
| Live vitals — listener count, stream bitrate, and the DJ's cumulative LLM-token ticker | `/now-playing` |
| On-air DJ — persona name, tagline, avatar, current show, guest co-hosts | `/now-playing` |
| The Booth — the live DJ session's chat log (what the AI DJ said/queued) | `/session` |
| On the Deck — up-next tease + recently played | `/state` |
| Request a track — plain-language song requests with live status | `POST /request` + `/request/:id` |
| Weekly schedule — the 7×24 grid painted in station-local time | `/schedule` |
| Play/pause + lock-screen controls (MediaSession) | `/stream.mp3`, `/cover/:id` |
| Cast to Google speakers / Chromecast — any browser, any network (the server-side cast bridge does the LAN part) | `radio.plexservernz.org/cast-bridge` (pychromecast agent + shared token) |

## Architecture — the one thing to understand before redesigning

```
src/
  config.ts          # station origin → apiUrl + streamUrl (one env var)

  lib/               # ── DATA LAYER — keep this ──
    types.ts         #   response shapes
    stationClient.ts #   the ONLY module that fetches the controller
    format.ts        #   pure display helpers (clock, timeAgo, gradients)

  hooks/             # ── DATA LAYER — keep this ──
    useStationFeed   #   one 5s poll of /now-playing + /state + /session, shared via context
    usePlayer        #   the <audio> element: tune-in gesture, play/pause, volume
    useElapsed       #   client-side track clock
    useRequest       #   submit a request + poll its outcome
    useSchedule      #   fetch /schedule once
    useMediaSession  #   OS lock-screen metadata + artwork
    useCast          #   Google Cast: cast the live stream to a speaker/Chromecast

  components/        # ── PRESENTATION — redesign this ──
    NowPlaying · PlayerBar · OnAir · BoothFeed · Queue · RequestBox · Schedule
    ui/              #   Avatar, SignalDot, Panel
```

**To redesign:** rewrite the components. They read everything through the hooks
and `stationClient`, so as long as your new UI consumes the same hooks, the
plumbing keeps working. Theme tokens (`--bg`, `--accent`, …) live at the top of
`src/index.css` — retint the whole player by editing those before touching a
single component.

## Notes on live-radio semantics

- **No seeking or skipping.** It's one shared stream. `usePlayer` only tunes in
  / pauses, and it re-points at the live edge on each play (a paused live stream
  goes stale). MediaSession deliberately leaves next/prev/seek unwired so a
  stray headphone tap can't skip for the whole room.
- **Autoplay needs a gesture.** Playback starts on the first tap (the "tune in"
  button) — browsers block autoplay with sound.
- **Casting hands the stream to the speaker.** The cast button (Chrome on
  desktop/Android, same Wi-Fi) makes the speaker fetch the stream URL itself —
  the phone just steers. Local playback pauses while casting; the speaker shows
  the station name (the Default Media Receiver only displays load-time
  metadata). Not supported on iOS/Firefox — the button simply never renders.
- **The track clock is approximate.** The server doesn't stream a playhead, so
  the progress bar counts client-side and re-syncs on every track change.

## What the flagship player also does (not included here, on purpose)

This starter stays small. The full SUB/WAVE web player additionally implements —
each is a good next exercise, and the endpoint is listed so you know where to
start:

- **Themes & skins** — `/themes` (token maps) and `ui.skin` on `/state`.
- **Opus codec upgrade** — probe `canPlayType('audio/ogg; codecs=opus')` and
  switch to `/stream.opus` when the station enables it (`stream.opusEnabled`).
- **PWA install** — manifest, icons, offline shell.
- **Audience analytics** — the fire-and-forget `POST /beacon`.
- **Community catalogs** — `/personas/community`, `/skills/community`,
  `/shows/community`.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | `eslint .` + `tsc -b` (full type-check) |

## License

MIT — clone it, gut it, ship your own.
