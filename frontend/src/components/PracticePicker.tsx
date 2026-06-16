import { useState } from 'react';
import type { GameMode } from '../types';

const DURATIONS = [15, 30, 60, 120];
const WORD_TARGETS = [10, 25, 50, 100];

type Tone = 'yellow' | 'red' | 'green' | 'gray';

interface Props {
  pattern: string;
  onPick: (mode: GameMode, length?: number) => void;
  onCancel: () => void;
  tone?: Tone;
  size?: 'sm' | 'lg';
}

const TONE_TEXT: Record<Tone, string> = {
  yellow: 'text-yellow-300',
  red: 'text-red-400',
  green: 'text-green-300',
  gray: 'text-gray-700 dark:text-gray-300',
};

// A compact two-step practice launcher: pick a mode, then its length.
// "survive" needs no length (dynamic timer), so it launches immediately.
export function PracticePicker({ pattern, onPick, onCancel, tone = 'gray', size = 'sm' }: Props) {
  const [step, setStep] = useState<'mode' | 'timed' | 'words'>('mode');

  const lg = size === 'lg';
  const btn = lg
    ? 'px-3 py-1.5 rounded-lg text-sm font-mono bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-yellow-400 hover:text-gray-900 transition-colors'
    : 'px-2 py-0.5 rounded text-xs font-mono bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-yellow-400 hover:text-gray-900 transition-colors';
  const closeBtn = 'text-xs text-gray-400 dark:text-gray-700 hover:text-gray-500 ml-1';

  if (lg) {
    // Larger stacked layout for the Pattern Wall card.
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        {step === 'mode' && (
          <>
            <p className="text-xs text-gray-500">choose mode</p>
            <div className="flex gap-2">
              <button className={btn} onClick={() => setStep('timed')}>timed</button>
              <button className={btn} onClick={() => setStep('words')}>words</button>
              <button className={btn} onClick={() => onPick('survive')}>survive</button>
            </div>
          </>
        )}
        {step === 'timed' && (
          <>
            <p className="text-xs text-gray-500">choose duration</p>
            <div className="flex gap-2">
              {DURATIONS.map(m => (
                <button key={m} className={btn} onClick={() => onPick('timed', m)}>{m}s</button>
              ))}
            </div>
          </>
        )}
        {step === 'words' && (
          <>
            <p className="text-xs text-gray-500">choose word count</p>
            <div className="flex gap-2">
              {WORD_TARGETS.map(t => (
                <button key={t} className={btn} onClick={() => onPick('words', t)}>{t}</button>
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => (step === 'mode' ? onCancel() : setStep('mode'))}
          className="text-xs text-gray-400 dark:text-gray-700 hover:text-gray-600 dark:hover:text-gray-500 transition-colors"
        >
          {step === 'mode' ? 'cancel' : '← back'}
        </button>
      </div>
    );
  }

  // Compact inline layout for the Results / Heatmap chips.
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`font-mono text-sm ${TONE_TEXT[tone]}`}>{pattern}</span>
      <span className="text-gray-400 dark:text-gray-600 text-xs mx-1">→</span>
      {step === 'mode' && (
        <>
          <button className={btn} onClick={() => setStep('timed')}>timed</button>
          <button className={btn} onClick={() => setStep('words')}>words</button>
          <button className={btn} onClick={() => onPick('survive')}>survive</button>
        </>
      )}
      {step === 'timed' && DURATIONS.map(m => (
        <button key={m} className={btn} onClick={() => onPick('timed', m)}>{m}s</button>
      ))}
      {step === 'words' && WORD_TARGETS.map(t => (
        <button key={t} className={btn} onClick={() => onPick('words', t)}>{t}</button>
      ))}
      <button
        onClick={() => (step === 'mode' ? onCancel() : setStep('mode'))}
        className={closeBtn}
      >
        {step === 'mode' ? '✕' : '←'}
      </button>
    </div>
  );
}
