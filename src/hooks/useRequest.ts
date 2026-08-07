// Drives a single listener song request end to end: POST /request, then poll
// /request/:id every couple of seconds until the outcome is terminal
// (resolved / failed / unknown). The controller does the slow LLM matching in
// the background, which is exactly why the HTTP call returns a requestId to
// poll rather than blocking.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRequestStatus, submitRequest } from '@/lib/stationClient';
import type { RequestResult, RequestStatus } from '@/lib/types';

const POLL_MS = 2000;
const MAX_POLLS = 60; // ~2 minutes, then give up

export type RequestPhase = 'idle' | 'submitting' | 'pending' | 'done';

export interface RequestState {
  phase: RequestPhase;
  status?: RequestStatus;
  result: RequestResult | null;
  error: string | null;
}

const IDLE: RequestState = { phase: 'idle', result: null, error: null };

export function useRequest() {
  const [state, setState] = useState<RequestState>(IDLE);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const countRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = undefined;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setState(IDLE);
  }, [stopPolling]);

  const submit = useCallback(
    async (text: string, name: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      stopPolling();
      countRef.current = 0;
      setState({ phase: 'submitting', result: null, error: null });

      let posted: RequestResult;
      try {
        posted = await submitRequest(trimmed, name.trim() || 'anon');
      } catch {
        setState({ phase: 'done', status: 'failed', result: null, error: 'network' });
        return;
      }

      // Some deployments resolve synchronously (no requestId) — treat that as
      // terminal immediately.
      if (!posted.requestId) {
        const status: RequestStatus = posted.success ? 'resolved' : 'failed';
        setState({ phase: 'done', status, result: posted, error: null });
        return;
      }

      const id = posted.requestId;
      setState({ phase: 'pending', status: 'pending', result: posted, error: null });

      pollRef.current = setInterval(async () => {
        countRef.current += 1;
        const r = await fetchRequestStatus(id);
        if (!r) return; // transient network blip — keep polling
        const status = r.status ?? (r.success ? 'resolved' : 'pending');
        if (status === 'pending' && countRef.current < MAX_POLLS) {
          setState((s) => ({ ...s, phase: 'pending', status: 'pending', result: r }));
          return;
        }
        stopPolling();
        setState({
          phase: 'done',
          status: countRef.current >= MAX_POLLS ? 'unknown' : status,
          result: r,
          error: null,
        });
      }, POLL_MS);
    },
    [stopPolling],
  );

  return { state, submit, reset };
}
