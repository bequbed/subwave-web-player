// The Booth: the live DJ session's chat history — what the AI DJ has actually
// said/queued this session, newest at the bottom. Each turn carries a `kind`
// (intro / link / request / station-id / weather / …) we surface as a small
// label so listeners can see *why* the DJ spoke.
//
// LONGWAVE renders this as a printed transcript: no rail, no tinted bubbles.
// Colour appears only as a 2px left rule on request (ember) and handoff (tide)
// turns.

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

// Only request (ember) and handoff (tide) turns carry a visible left rule.
// Ordinary turns keep the transparent border purely to hold the indent, so the
// transcript reads as one column of type with no per-turn rail.
function kindRule(kind: string | undefined): string {
  if (kind === 'request') return 'border-[var(--ember)]';
  if (kind === 'handoff') return 'border-[var(--tide)]';
  return 'border-transparent';
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
      aside={
        <span className="text-[11px] tabular-nums text-[var(--pencil)]">
          {messages.length} on air
        </span>
      }
      className="h-full"
    >
      <div ref={scrollRef} className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-5">
        {!ready ? (
          <p className="py-8 text-center text-sm text-[var(--pencil)]">Tuning in…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--pencil)]">
            The DJ hasn&apos;t spoken yet this session.
          </p>
        ) : (
          <ul className="space-y-5">
            {messages.map((m, i) => (
              <li key={`${m.t ?? i}-${i}`} className={`border-l-2 pl-4 ${kindRule(m.kind)}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pencil)]">
                    {turnLabel(m)}
                  </span>
                  {m.t != null && (
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--pencil)]">
                      {timeAgo(m.t)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-[1.55] text-[var(--graphite)]">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
