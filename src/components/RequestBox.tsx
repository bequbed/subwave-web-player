// Listener song requests. You type it in plain language ("play Diljit latest",
// "something rainy") plus a name; the DJ agent matches it against the library
// and works it into the flow. The POST returns instantly and we poll for the
// outcome, so this shows a live "finding your track…" → resolved/failed card.
//
// Quick-pick chips (mirroring the SubWave app's "On the wire"): one tap
// prefills the request from live station context — the current artist, the
// weather, the time-of-day vibe — plus a wildcard. All derived from the
// already-polled /now-playing snapshot; no extra requests.
//
// LONGWAVE: Send is ink-filled, not ember — Tune In is the only filled ember
// element on the page.

import { useId, useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { useStationFeed } from '@/hooks/useStationFeed';
import { Panel } from '@/components/ui/Panel';
import type { NowPlayingResponse } from '@/lib/types';

const FIELD =
  'w-full min-w-0 rounded-[2px] border border-[var(--rule)] bg-[var(--leaf-raised)] px-3.5 text-sm text-[var(--graphite)] placeholder:text-[var(--pencil)] focus:border-[var(--ember)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ember)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-60';

/** Weather condition → request-slip phrasing (matches the app's "rainy day"
    chip grammar). Unknown conditions fall through to "<condition> vibes". */
function weatherPick(condition: string): string {
  const c = condition.toLowerCase();
  if (/rain|drizzle|shower/.test(c)) return 'something for a rainy day';
  if (/sun|clear|fine/.test(c)) return 'something for a sunny day';
  if (/cloud|overcast/.test(c)) return 'something for grey skies';
  if (/snow|sleet|hail/.test(c)) return 'something for a snow day';
  if (/wind/.test(c)) return 'something for a wild windy day';
  if (/storm|thunder/.test(c)) return 'something for a stormy night';
  if (/fog|mist/.test(c)) return 'something for the mist';
  return `something for a ${c} day`;
}

/** The four chips, in the app's order. Only chips with real context show. */
function quickPicks(np: NowPlayingResponse | null | undefined) {
  const picks: { label: string; sub: string; text: string }[] = [];
  const artist = np?.nowPlaying?.artist;
  if (artist) picks.push({ label: 'More like this', sub: `more ${artist}`, text: `More like ${artist}` });

  const vibe = np?.context?.time?.vibe || np?.context?.time?.show;
  if (vibe) picks.push({ label: vibe, sub: 'right now', text: `Something for the ${vibe.toLowerCase()}` });

  const weather = np?.context?.weather?.condition;
  if (weather) picks.push({ label: weatherPick(weather), sub: 'weather', text: weatherPick(weather) });

  picks.push({ label: 'Surprise me', sub: 'random', text: 'Surprise me' });
  return picks;
}

export function RequestBox() {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const requestId = useId();
  const nameId = useId();
  const { state, submit, reset } = useRequest();
  const { nowPlaying } = useStationFeed();

  const busy = state.phase === 'submitting' || state.phase === 'pending';
  const failed = state.phase === 'done' && state.status === 'failed';
  const picks = quickPicks(nowPlaying);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!busy) submit(text, name);
  }

  function pick(p: { text: string }) {
    setText(p.text);
  }

  const track = state.result?.track ?? null;
  const reply = state.result?.reply || state.result?.message;

  return (
    <Panel title="Request a track">
      <div className="flex flex-col p-4 sm:p-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <label
            htmlFor={requestId}
            className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pencil)]"
          >
            Song, artist, or vibe
          </label>
          <input
            id={requestId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Play something… (artist, song, or a vibe)"
            maxLength={200}
            disabled={busy}
            className={`${FIELD} py-3`}
          />

          {/* Quick picks — one tap prefills the slip from live station
              context (current artist / time vibe / weather / wildcard). */}
          <div className="flex flex-wrap gap-2" aria-label="Quick request suggestions">
            {picks.map((p) => (
              <button
                key={p.sub + p.label}
                type="button"
                onClick={() => pick(p)}
                disabled={busy}
                className="group max-w-full rounded-[2px] border border-[var(--rule)] bg-[var(--leaf)] px-3 py-1.5 text-left transition-colors hover:border-[var(--ember)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block truncate text-[13px] font-medium leading-tight text-[var(--graphite)] group-hover:text-[var(--ember)]">
                  {p.label}
                </span>
                <span className="block truncate text-[9px] font-semibold uppercase leading-tight tracking-[0.14em] text-[var(--pencil)]">
                  {p.sub}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label
              htmlFor={nameId}
              className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pencil)]"
            >
              Your name <span className="font-normal normal-case tracking-normal">(optional)</span>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                maxLength={40}
                disabled={busy}
                className={`${FIELD} mt-1.5 py-2.5 font-normal normal-case tracking-normal`}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="shrink-0 rounded-[4px] bg-[var(--graphite)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--paper)] transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ember)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>

        {/* Outcome */}
        <div
          className="mt-4"
          role={failed ? 'alert' : 'status'}
          aria-live="polite"
          aria-atomic="true"
          aria-relevant="additions text"
        >
          {state.phase === 'pending' && (
            <p className="rounded-[4px] border border-[var(--rule)] border-l-2 border-l-[var(--ember)] bg-[var(--leaf-raised)] p-3 text-sm text-[var(--graphite)]">
              Finding your track…
            </p>
          )}
          {state.phase === 'done' && (
            <div
              className={`rounded-[4px] border border-[var(--rule)] border-l-2 bg-[var(--leaf-raised)] p-3.5 ${
                state.status === 'resolved'
                  ? 'border-l-[var(--tide)]'
                  : state.status === 'failed'
                    ? 'border-l-[var(--ember)]'
                    : 'border-l-[var(--pencil)]'
              }`}
            >
              {state.status === 'resolved' ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--tide)]">
                    Queued up
                  </p>
                  {track && (
                    <p className="mt-1.5 text-sm text-[var(--pencil)]">
                      <span className="text-[var(--graphite)]">{track.title}</span>
                      {track.artist ? ` — ${track.artist}` : ''}
                    </p>
                  )}
                  {reply && (
                    <p className="mt-1 text-[11px] italic leading-[1.55] text-[var(--pencil)]">
                      &ldquo;{reply}&rdquo;
                    </p>
                  )}
                </>
              ) : state.status === 'failed' ? (
                <p className="text-sm text-[var(--graphite)]">
                  Couldn&apos;t find that one in the library. Try another?
                </p>
              ) : (
                <p className="text-sm text-[var(--graphite)]">
                  Still working on it — it may turn up on air shortly.
                </p>
              )}
              <button
                onClick={reset}
                className="mt-3 rounded-[2px] text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember)] underline decoration-[var(--rule)] underline-offset-4 hover:decoration-[var(--ember)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ember)]"
              >
                Request another
              </button>
            </div>
          )}
          {state.phase === 'idle' && (
            <p className="text-[11px] leading-[1.55] text-[var(--pencil)]">
              Everyone hears the same stream — your pick plays for the whole room.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
