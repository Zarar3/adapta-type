import { useCallback, useRef, useState } from 'react';

const STORAGE_KEY = 'adapta-type-sound';

export function useSound() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'off');
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  };

  const play = useCallback((freq: number, dur: number, gain = 0.15, type: OscillatorType = 'sine') => {
    if (!enabled) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type;
      vol.gain.setValueAtTime(gain, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* silent */ }
  }, [enabled]);

  const playCorrect = useCallback(() => play(800, 0.04, 0.12), [play]);
  const playWrong   = useCallback(() => play(220, 0.08, 0.18), [play]);

  // Survive mode event sounds
  const playSurviveCleanWord = useCallback(() => {
    play(900, 0.07, 0.09);
  }, [play]);

  const playSurviveGolden = useCallback(() => {
    if (!enabled) return;
    // Ascending sparkle arpeggio
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => play(freq, 0.12, 0.14), i * 65);
    });
  }, [play, enabled]);

  const playSurviveBombExplode = useCallback(() => {
    if (!enabled) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.28);
      vol.gain.setValueAtTime(0.28, ctx.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch { /* silent */ }
  }, [enabled]);

  const playSurviveBombDefuse = useCallback(() => {
    // Quick triumphant chime
    play(660, 0.09, 0.14);
    setTimeout(() => play(880, 0.12, 0.13), 70);
    setTimeout(() => play(1047, 0.18, 0.11), 140);
  }, [play]);

  const playSurviveFreeze = useCallback(() => {
    // Icy high shimmer
    play(1760, 0.14, 0.09, 'triangle');
    setTimeout(() => play(2093, 0.14, 0.07, 'triangle'), 80);
  }, [play]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      localStorage.setItem(STORAGE_KEY, prev ? 'off' : 'on');
      return !prev;
    });
  }, []);

  return {
    enabled, toggle, playCorrect, playWrong,
    playSurviveCleanWord, playSurviveGolden,
    playSurviveBombExplode, playSurviveBombDefuse, playSurviveFreeze,
  };
}
