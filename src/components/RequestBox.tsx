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
      <div className="flex h-full flex-col p-4">
        <form onSubmit={onSubmit} className="space-y-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Play something… (artist, song, or a vibe)"
            maxLength={200}
            disabled={busy}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-60"
          />
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              maxLength={40}
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="shrink-0 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>

        {/* Outcome */}
        <div className="mt-3 flex-1">
          {state.phase === 'pending' && (
            <p className="text-sm text-[var(--accent)]">🎧 Finding your track…</p>
          )}
          {state.phase === 'done' && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3">
              {state.status === 'resolved' ? (
                <>
                  <p className="text-sm font-medium text-[var(--fg)]">✓ Queued up</p>
                  {track && (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      <span className="text-[var(--fg)]">{track.title}</span>
                      {track.artist ? ` — ${track.artist}` : ''}
                    </p>
                  )}
                  {reply && <p className="mt-1 text-xs italic text-[var(--muted)]">“{reply}”</p>}
                </>
              ) : state.status === 'failed' ? (
                <p className="text-sm text-[var(--muted)]">
                  Couldn&apos;t find that one in the library. Try another?
                </p>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Still working on it — it may turn up on air shortly.
                </p>
              )}
              <button
                onClick={reset}
                className="mt-2 text-xs text-[var(--accent)] hover:underline"
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
