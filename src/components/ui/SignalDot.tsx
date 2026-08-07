// A small connection indicator. Green + pulsing when the feed is live, amber
// when we're running on a stale snapshot ("reconnecting"), grey before the
// first poll lands.

export function SignalDot({ online, ready }: { online: boolean; ready: boolean }) {
  const color = !ready ? 'var(--muted)' : online ? '#4ade80' : '#fbbf24';
  const label = !ready ? 'connecting' : online ? 'live' : 'reconnecting';
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--muted)]">
      <span
        className={`inline-block h-2 w-2 rounded-full ${online && ready ? 'pulse-ring' : ''}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
