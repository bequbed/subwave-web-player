// Listener song requests. You type it in plain language ("play Diljit latest",
// "something rainy") plus a name; the DJ agent matches it against the library
// and works it into the flow. The POST returns instantly and we poll for the
// outcome, so this shows a live "finding your track…" → resolved/failed card.
//
// LONGWAVE: Send is ink-filled, not ember — Tune In is the only filled ember
// element on the page.

import { useId, useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { Panel } from '@/components/ui/Panel';

const FIELD =
  'w-full min-w-0 rounded-[2px] border border-[var(--rule)] bg-[var(--leaf-raised)] px-3.5 text-sm text-[var(--graphite)] placeholder:text-[var(--pencil)] focus:border-[var(--ember)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ember)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-60';

export function RequestBox() {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const requestId = useId();
  const nameId = useId();
  const { state, submit, reset } = useRequest();

  const busy = state.phase === 'submitting' || state.phase === 'pending';
  const failed = state.phase === 'done' && state.status === 'failed';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!busy) submit(text, name);
  }

  const track = state.result?.track ?? null;
  const reply = state.result?.reply || state.result?.message;

  return (
    <Panel title="Request a track" className="h-full">
      <div className="flex h-full flex-col p-4 sm:p-5">
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
          className="mt-4 flex-1"
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
