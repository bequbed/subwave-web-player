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

function kindStyle(kind: string | undefined): string {
  if (kind === 'play') {
    return 'border-[var(--signal)]/35 bg-[var(--signal)]/10 text-[var(--signal)]';
  }
  if (kind === 'handoff') {
    return 'border-[var(--atmosphere)]/35 bg-[var(--atmosphere)]/10 text-[var(--atmosphere)]';
  }
  if (kind === 'request') {
    return 'border-amber-300/30 bg-amber-300/10 text-amber-200';
  }
  return 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--muted)]';
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
      <div ref={scrollRef} className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-5">
        {!ready ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Tuning in…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            The DJ hasn&apos;t spoken yet this session.
          </p>
        ) : (
          <ul className="ml-1 space-y-5 border-l border-[var(--line)] pl-5">
            {messages.map((m, i) => (
              <li key={`${m.t ?? i}-${i}`} className="relative flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.47rem] top-1.5 h-2 w-2 rounded-full border-2 border-[var(--panel)] bg-[var(--signal)] shadow-[0_0_0_1px_var(--line)]"
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${kindStyle(m.kind)}`}
                  >
                    {turnLabel(m)}
                  </span>
                  {m.t != null && (
                    <span className="text-[10px] text-[var(--muted)]">{timeAgo(m.t)}</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-[var(--fg)]/90 sm:text-[15px]">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
