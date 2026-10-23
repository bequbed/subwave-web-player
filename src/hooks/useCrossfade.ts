// A colour change as an opacity crossfade between two stacked layers, for the
// big cover-tinted washes. Transitioning the colour itself re-rasterises the
// gradient on every frame; here each layer paints once and the compositor fades
// the opacity.
//
// A new value paints into the hidden layer, which then becomes the front. Until
// that fade ends the outgoing layer is still on screen, so a value that lands
// mid-fade waits for it, and the latest value wins.

import { useEffect, useState } from 'react';

export interface Crossfade<T> {
  /** What each layer holds. */
  layers: readonly [T, T];
  /** The layer showing, or fading in. */
  front: 0 | 1;
  /** A fade is running, so the hidden layer is still on screen. */
  fading: boolean;
}

function start<T>(value: T): Crossfade<T> {
  return { layers: [value, value], front: 0, fading: false };
}

function to<T>(state: Crossfade<T>, value: T, instant: boolean): Crossfade<T> {
  if (Object.is(state.layers[state.front], value)) return state;
  if (state.fading && !instant) return state;
  const back = state.front === 0 ? 1 : 0;
  const layers: readonly [T, T] = back === 0 ? [value, state.layers[1]] : [state.layers[0], value];
  return { layers, front: back, fading: !instant };
}

function settled<T>(state: Crossfade<T>): Crossfade<T> {
  return state.fading ? { ...state, fading: false } : state;
}

export function useCrossfade<T>(value: T, fadeMs: number): Crossfade<T> {
  const [state, setState] = useState(() => start(value));

  useEffect(() => {
    setState((s) => to(s, value, fadeMs <= 0));
  }, [value, fadeMs, state.fading]);

  useEffect(() => {
    if (!state.fading) return;
    const id = setTimeout(() => setState(settled), fadeMs);
    return () => clearTimeout(id);
  }, [state.fading, fadeMs]);

  return state;
}
