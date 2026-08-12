// Cast support via the server-side cast bridge.
//
// History: this hook originally drove Google's Cast Web Sender SDK (CAF)
// directly. On this deployment CAF proved unreliable at the *session* layer
// — requestSession() failed or hung on the sender, so a session was never
// established and the receiver never fetched the stream, while the same
// stream cast from a native sender (the SubWave app, or pychromecast from
// the LAN) played every time. Rather than fight the SDK, the player now
// steers a server-side bridge (pychromecast on the station's LAN) through
// a small HTTP API. Benefits:
//   - the load path is the one proven to work on this hardware;
//   - no same-Wi-Fi requirement for the sender (the server is on the LAN);
//   - works in every browser, including iOS Safari and Firefox;
//   - the bridge reports the receiver's honest state (playerState +
//     currentTime), which the rail uses to distinguish the Default Media
//     Receiver's 1.5–3 minute warm-up ("warming up…") from real playback.
//
// Bridge API (see the cast-bridge service; X-Cast-Token required):
//   GET  /devices          -> {devices: [{name, cast_type, host, port}]}
//   POST /cast   {device}  -> {ok}
//   POST /stop   {device}  -> {ok}
//   GET  /status           -> {sessions: [{device, state, currentTime,
//                                          idleReason, contentId, volume}]}

import { useEffect, useRef, useState } from 'react';
import { config } from '@/config';

export type CastState = 'idle' | 'connecting' | 'connected';

/** A speaker / receiver discovered on the LAN by the bridge. */
export interface BridgeDevice {
  name: string;
  cast_type: string | null;
  host: string;
  port: number;
}

/** What the bridge reports the receiver is doing with the stream. */
export type ReceiverState =
  | 'unknown'
  | 'idle'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'finished'
  | 'stopped'
  | 'error';

/** One active bridge session (the device we are casting to). */
interface BridgeSession {
  device: string;
  state: string | null;
  currentTime: number | null;
  idleReason: string | null;
  contentId: string | null;
}

const POLL_MS = 2000;

async function bridgeFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${config.castBridgeUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Cast-Token': config.castToken,
      ...init?.headers,
    },
  });
}

function classifyReceiver(state?: string | null, idleReason?: string | null): ReceiverState {
  switch (state) {
    case 'PLAYING':
      return 'playing';
    case 'BUFFERING':
      return 'buffering';
    case 'PAUSED':
      return 'paused';
    case 'IDLE':
      if (idleReason === 'ERROR') return 'error';
      if (idleReason === 'FINISHED') return 'finished';
      if (idleReason === 'CANCELLED') return 'stopped';
      return 'idle';
    default:
      return 'unknown';
  }
}

export interface Cast {
  /** 'idle' no session; 'connecting' a cast is being started; 'connected'
   *  the bridge has an active session on a speaker. */
  state: CastState;
  /** Friendly name of the receiving device while connected. */
  deviceName: string | null;
  /** Receiver-reported media state, polled every 2s while connected. */
  receiverState: ReceiverState;
  /** Live playback position (s) the receiver reports — the honest
   *  "is it actually playing" tell. Stays 0 during the 1.5–3 min warm-up. */
  receiverPosition: number | null;
  /** Set when the bridge is unreachable or rejects; shown on the rail. */
  castError: string | null;
  /** Speaker list for the picker, or null when the picker is closed. */
  devices: BridgeDevice[] | null;
  /** Always true — the bridge works in any browser. */
  supported: boolean;
  /** Open the speaker picker (loads the device list from the bridge). */
  cast: () => Promise<void>;
  /** Cast the live stream to a specific speaker. */
  castTo: (device: string) => Promise<void>;
  /** End the session on the speaker. */
  stop: () => Promise<void>;
  /** Close the speaker picker without casting. */
  closePicker: () => void;
}

export function useCast(): Cast {
  const [state, setState] = useState<CastState>('idle');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [receiverState, setReceiverState] = useState<ReceiverState>('unknown');
  const [receiverPosition, setReceiverPosition] = useState<number | null>(null);
  const [castError, setCastError] = useState<string | null>(null);
  const [devices, setDevices] = useState<BridgeDevice[] | null>(null);
  // Which device the status poll should look for.
  const targetRef = useRef<string | null>(null);

  async function cast(): Promise<void> {
    setCastError(null);
    setDevices(null);
    try {
      const r = await bridgeFetch('/devices');
      if (!r.ok) throw new Error(`bridge ${r.status}`);
      const data = (await r.json()) as { devices?: BridgeDevice[] };
      const list = data.devices ?? [];
      if (list.length === 0) {
        setCastError('No speakers found on the network');
        return;
      }
      setDevices(list);
    } catch (err) {
      console.warn('[cast] device list failed:', err);
      setCastError('Cast bridge unreachable — is the server up?');
    }
  }

  async function castTo(device: string): Promise<void> {
    setCastError(null);
    setDevices(null);
    setState('connecting');
    try {
      const r = await bridgeFetch('/cast', {
        method: 'POST',
        body: JSON.stringify({ device }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || data.ok !== true) {
        throw new Error(data.error ?? `bridge ${r.status}`);
      }
      targetRef.current = device;
      setDeviceName(device);
      setState('connected');
    } catch (err) {
      console.warn('[cast] start failed:', err);
      setCastError(`Cast failed: ${(err as Error).message ?? 'unknown error'}`);
      setState('idle');
    }
  }

  async function stop(): Promise<void> {
    const target = targetRef.current;
    targetRef.current = null;
    if (target) {
      try {
        await bridgeFetch('/stop', {
          method: 'POST',
          body: JSON.stringify({ device: target }),
        });
      } catch (err) {
        console.warn('[cast] stop failed:', err);
      }
    }
    setState('idle');
    setDeviceName(null);
    setReceiverState('unknown');
    setReceiverPosition(null);
    setCastError(null);
  }

  function closePicker(): void {
    setDevices(null);
  }

  // Poll the bridge for the receiver's state while a session is active.
  useEffect(() => {
    if (state !== 'connected') {
      setReceiverState('unknown');
      setReceiverPosition(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await bridgeFetch('/status');
        if (!r.ok) throw new Error(`bridge ${r.status}`);
        const data = (await r.json()) as { sessions?: BridgeSession[] };
        const target = targetRef.current;
        const session = (data.sessions ?? []).find((s) => s.device === target);
        if (cancelled) return;
        if (!session) {
          // The bridge no longer tracks the session (it ended or the bridge
          // restarted). Surface it rather than pretending it is healthy.
          setReceiverState('unknown');
          setReceiverPosition(null);
          return;
        }
        setReceiverState(classifyReceiver(session.state, session.idleReason));
        setReceiverPosition(
          typeof session.currentTime === 'number' ? session.currentTime : null,
        );
        setCastError(null);
      } catch (err) {
        if (cancelled) return;
        console.warn('[cast] status poll failed:', err);
        setCastError('Cast bridge unreachable — status paused');
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [state]);

  return {
    state,
    deviceName,
    receiverState,
    receiverPosition,
    castError,
    devices,
    supported: true,
    cast,
    castTo,
    stop,
    closePicker,
  };
}
