// A round persona portrait with a graceful fallback to initials when the image
// is missing (the controller serves a transparent 1×1 for personas without an
// avatar, so we detect a failed/empty load and paint initials instead).

import { useState } from 'react';
import { gradientFor } from '@/lib/format';

function initials(name: string | undefined): string {
  const parts = (name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string;
  name?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold text-[var(--paper)] ring-1 ring-[var(--rule)]"
      style={{ width: size, height: size, background: gradientFor(name) }}
      aria-hidden={!name}
    >
      {showImg ? (
        <img
          src={src}
          alt={name || ''}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
