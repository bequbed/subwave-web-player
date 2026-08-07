// Listener song requests. You type it in plain language ("play Diljit latest",
// "something rainy") plus a name; the DJ agent matches it against the library
// and works it into the flow. The POST returns instantly and we poll for the
// outcome, so this shows a live "finding your track…" → resolved/failed card.

import { useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { Panel } from '@/components/ui/Panel';

export function RequestBox() {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const { state, submit, reset } = useRequest();

  const busy = state.phase === 'submitting' || state.phase === 'pending';

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
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Play something… (artist, song, or a vibe)"
            maxLength={200}
            disabled={busy}
            className="w-full rounded-xl border border-white/15 bg-black/25 px-3.5 py-3 text-sm text-[var(--fg)] shadow-inner shadow-black/20 placeholder:text-[var(--muted)] focus:border-[var(--signal)] focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              maxLength={40}
              disabled={busy}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3.5 py-2.5 text-sm text-[var(--fg)] shadow-inner shadow-black/20 placeholder:text-[var(--muted)] focus:border-[var(--signal)] focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="shrink-0 rounded-xl bg-[var(--signal)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] shadow-[0_8px_24px_color-mix(in_srgb,var(--signal)_18%,transparent)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--signal)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>

        {/* Outcome */}
        <div className="mt-4 flex-1">
          {state.phase === 'pending' && (
            <p className="rounded-xl border border-[var(--signal)]/25 bg-[var(--signal)]/8 p-3 text-sm text-[var(--signal)]">
              🎧 Finding your track…
            </p>
          )}
          {state.phase === 'done' && (
            <div
              className={`rounded-xl border p-3.5 ${
                state.status === 'resolved'
                  ? 'border-[var(--signal)]/30 bg-[var(--signal)]/8'
                  : state.status === 'failed'
                    ? 'border-red-300/25 bg-red-300/8'
                    : 'border-[var(--atmosphere)]/30 bg-[var(--atmosphere)]/8'
              }`}
            >
              {state.status === 'resolved' ? (
                <>
                  <p className="text-sm font-semibold text-[var(--signal)]">✓ Queued up</p>
                  {track && (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      <span className="text-[var(--fg)]">{track.title}</span>
                      {track.artist ? ` — ${track.artist}` : ''}
                    </p>
                  )}
                  {reply && <p className="mt-1 text-xs italic text-[var(--muted)]">“{reply}”</p>}
                </>
              ) : state.status === 'failed' ? (
                <p className="text-sm text-red-100/80">
                  Couldn&apos;t find that one in the library. Try another?
                </p>
              ) : (
                <p className="text-sm text-[var(--atmosphere)]">
                  Still working on it — it may turn up on air shortly.
                </p>
              )}
              <button
                onClick={reset}
                className="mt-3 rounded-sm text-xs font-semibold text-[var(--signal)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--signal)]"
              >
                Request another
              </button>
            </div>
          )}
          {state.phase === 'idle' && (
            <p className="text-xs text-[var(--muted)]">
              Everyone hears the same stream — your pick plays for the whole room.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
