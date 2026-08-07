// Fetches the weekly schedule once on mount. It changes rarely, so it lives
// outside the 5s feed loop. Exposes a tiny loading/error envelope so the
// Schedule component can render a skeleton and never throw.

import { useEffect, useState } from 'react';
import { fetchSchedule } from '@/lib/stationClient';
import type { SchedulePayload } from '@/lib/types';

export interface ScheduleState {
  data: SchedulePayload | null;
  loading: boolean;
  error: boolean;
}

export function useSchedule(): ScheduleState {
  const [data, setData] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSchedule()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
