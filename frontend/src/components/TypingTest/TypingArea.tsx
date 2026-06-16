import { useCallback, useEffect, useRef, useState } from 'react';
import { WordDisplay } from './WordDisplay';
import { TimerBar } from './TimerBar';
import { calcWpm, calcAccuracy } from '../../lib/statsCalculator';
import type { TestState, TimedMode } from '../../types';

interface LineData {
  words: string[];
  charStates: ('untyped' | 'correct' | 'incorrect' | 'extra')[][];
}

interface Props {
  testState: TestState;
  timeLeft: number;
  duration: TimedMode;
  line: LineData;
  currentWord: number;
  currentChar: number;
  ngramDisplayOrder: string[];
  ngramStreaks: Record<string, number>;
  difficultyLevel: number;
  focusedPattern: string | null;
  showLineHint: boolean;
  correctChars: number;
  totalChars: number;
  onKeyDown: (e: KeyboardEvent) => void;
  onChangeDuration: (d: TimedMode) => void;
  onRestart: () => void;
  onEndTest?: () => void;
  playCorrect?: () => void;
  playWrong?: () => void;
}

const DIFFICULTY_LABELS = ['', 'easy', 'medium', 'hard', 'expert'];

export function TypingArea({
  testState, timeLeft, duration, line,
  currentWord, currentChar, ngramDisplayOrder, ngramStreaks, difficultyLevel, focusedPattern, showLineHint,
  correctChars, totalChars, onKeyDown, onChangeDuration, onRestart, onEndTest, playCorrect, playWrong,
}: Props) {
  const focusPatterns = focusedPattern ? [] : ngramDisplayOrder;

  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyWithSound = useCallback((e: KeyboardEvent) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const expected = line.words[currentWord]?.[currentChar];
      if (expected !== undefined) {
        e.key === expected ? playCorrect?.() : playWrong?.();
      }
    }
    onKeyDown(e);
  }, [line, currentWord, currentChar, onKeyDown, playCorrect, playWrong]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.addEventListener('keydown', handleKeyWithSound);
    return () => el.removeEventListener('keydown', handleKeyWithSound);
  }, [handleKeyWithSound]);

  const [capsLock, setCapsLock] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => setCapsLock(e.getModifierState('CapsLock'));
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', handler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', handler); };
  }, []);

  const [flashKey, setFlashKey] = useState(0);
  const prevDifficulty = useRef(difficultyLevel);
  useEffect(() => {
    if (difficultyLevel !== prevDifficulty.current) {
      setFlashKey(k => k + 1);
      prevDifficulty.current = difficultyLevel;
    }
  }, [difficultyLevel]);

  const elapsed = duration === 'infinite'
    ? timeLeft * 1000
    : ((duration as number) - timeLeft) * 1000;
  const liveWpm = elapsed > 0 ? calcWpm(correctChars, elapsed) : 0;
  const liveAccuracy = calcAccuracy(correctChars, totalChars);

  return (
    <div
      className="w-full max-w-5xl mx-auto cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoFocus
        readOnly
        inputMode="text"
        aria-hidden
      />

      <TimerBar
        testState={testState}
        timeLeft={timeLeft}
        duration={duration}
        onChangeDuration={onChangeDuration}
      />

      {testState === 'idle' && (
        <p className="text-center text-gray-400 dark:text-gray-600 text-sm mb-4">click here or start typing</p>
      )}

      {testState === 'running' && (
        <>
          <div className="flex justify-center gap-6 mb-4 text-sm font-mono">
            <span className="text-gray-600 dark:text-gray-300">{liveWpm} <span className="text-yellow-400/60">wpm</span></span>
            <span className="text-gray-600 dark:text-gray-300">{liveAccuracy}% <span className="text-yellow-400/60">acc</span></span>
          </div>
          <div className="flex justify-end mb-1">
            <span
              key={flashKey}
              className={`text-xs font-mono animate-flash ${
                difficultyLevel >= 4 ? 'text-red-400' :
                difficultyLevel >= 3 ? 'text-orange-400' :
                difficultyLevel >= 2 ? 'text-yellow-400' : 'text-green-400'
              }`}
            >
              {DIFFICULTY_LABELS[difficultyLevel]}
            </span>
          </div>
        </>
      )}

      {capsLock && (
        <p className="text-center text-yellow-500/70 text-xs mb-3">caps lock is on</p>
      )}

      {focusPatterns.length > 0 && testState !== 'idle' && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500">focusing on:</span>
          {focusPatterns.map(pattern => {
            const streak = ngramStreaks[pattern] ?? 0;
            return (
              <div
                key={pattern}
                className="flex flex-col items-center gap-1 px-2 py-1 rounded bg-yellow-400/10 border border-yellow-400/20"
              >
                <span className="text-yellow-300 text-xs font-mono tracking-wide">{pattern}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-1.5 rounded-sm ${i < streak ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-700'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="select-none">
        <WordDisplay
          words={line.words}
          charStates={line.charStates}
          isActive
          activeWord={currentWord}
          activeChar={currentChar}
          showHint={showLineHint}
        />
      </div>

      {testState === 'running' && (
        <div className="flex justify-center gap-4 mt-6">
          {duration === 'infinite' && (
            <button
              onClick={onEndTest}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors font-mono"
            >
              end
            </button>
          )}
          <button
            onClick={onRestart}
            className="text-xs text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500 transition-colors font-mono"
          >
            restart
          </button>
        </div>
      )}
    </div>
  );
}
