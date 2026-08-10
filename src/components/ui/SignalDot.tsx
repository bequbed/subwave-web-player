// A small connection indicator. Ember + breathing when the feed is live, a
// warm amber when we're running on a stale snapshot ("reconnecting"), pencil
// grey before the first poll lands.

export function SignalDot({ online, ready }: { online: boolean; ready: boolean }) {
  const color = !ready ? 'var(--pencil)' : online ? 'var(--ember)' : '#8a6d1f';
  const label = !ready ? 'connecting' : online ? 'live' : 'reconnecting';
  return (
    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--pencil)]">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${online && ready ? 'pulse-ring' : ''}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
