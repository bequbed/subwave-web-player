// The Booth: the live DJ session's chat history — what the AI DJ has actually
// said/queued this session, newest at the bottom. Each turn carries a `kind`
// (intro / link / request / station-id / weather / …) we surface as a small
// label so listeners can see *why* the DJ spoke.

import { useEffect, useRef } from 'react';
import { useStationFeed } from '@/hooks/useStationFeed';
import { Panel } from '@/components/ui/Panel';
import { timeAgo } from '@/lib/format';
import type { SessionMessage } from '@/lib/types';

const KIND_LABEL: Record<string, string> = {
  intro: 'intro',
  link: 'segue',
  request: 'request',
  'station-id': 'ident',
  station_id: 'ident',
  weather: 'weather',
  news: 'news',
  hourly: 'time check',
  banter: 'banter',
  event: 'now playing',
};

function turnLabel(m: SessionMessage): string {
  if (m.kind && KIND_LABEL[m.kind]) return KIND_LABEL[m.kind];
  return m.kind || m.role || 'dj';
}

export function BoothFeed() {
  const { session, ready } = useStationFeed();
  const messages = (session?.messages ?? []).filter((m) => (m.text ?? '').trim().length > 0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep pinned to the latest turn as new ones arrive.
  const lastCount = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && messages.length !== lastCount.current) {
      el.scrollTop = el.scrollHeight;
      lastCount.current = messages.length;
    }
  }, [messages.length]);

  return (
    <Panel
      title="The Booth"
      aside={<span className="text-[11px] text-[var(--muted)]">{messages.length} on air</span>}
      className="h-full"
    >
      <div ref={scrollRef} className="scroll-thin h-full overflow-y-auto px-4 py-3">
        {!ready ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Tuning in…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            The DJ hasn&apos;t spoken yet this session.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => (
              <li key={`${m.t ?? i}-${i}`} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]">
                    {turnLabel(m)}
                  </span>
                  {m.t != null && (
                    <span className="text-[10px] text-[var(--muted)]">{timeAgo(m.t)}</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-[var(--fg)]/90">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
