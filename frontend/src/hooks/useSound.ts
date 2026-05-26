import { useCallback, useRef, useState } from 'react';

const STORAGE_KEY = 'adapta-type-sound';

export function useSound() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'off');
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  };

  const play = useCallback((freq: number, dur: number, gain = 0.15) => {
    if (!enabled) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      vol.gain.setValueAtTime(gain, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // AudioContext not available — fail silently
    }
  }, [enabled]);

  const playCorrect = useCallback(() => play(800, 0.04, 0.12), [play]);
  const playWrong   = useCallback(() => play(220, 0.08, 0.18), [play]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      localStorage.setItem(STORAGE_KEY, prev ? 'off' : 'on');
      return !prev;
    });
  }, []);

  return { enabled, toggle, playCorrect, playWrong };
}
