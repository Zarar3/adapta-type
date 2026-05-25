import { useEffect, useRef } from 'react';
import { WordDisplay } from './WordDisplay';
import { TimerBar } from './TimerBar';
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
  ngrams: Record<string, number>;
  ngramStreaks: Record<string, number>;
  difficultyLevel: number;
  onKeyDown: (e: KeyboardEvent) => void;
  onChangeDuration: (d: TimedMode) => void;
}

const DIFFICULTY_LABELS = ['', 'easy', 'medium', 'hard', 'expert'];

export function TypingArea({
  testState, timeLeft, duration, line,
  currentWord, currentChar, ngrams, ngramStreaks, difficultyLevel, onKeyDown, onChangeDuration,
}: Props) {
  const focusPatterns = Object.entries(ngrams)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k]) => k);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <div
      className="w-full max-w-5xl mx-auto cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden input captures keyboard events */}
      <input
        ref={inputRef}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoFocus
        readOnly
        aria-hidden
      />

      <TimerBar
        testState={testState}
        timeLeft={timeLeft}
        duration={duration}
        onChangeDuration={onChangeDuration}
      />

      {testState === 'idle' && (
        <p className="text-center text-gray-600 text-sm mb-4">click here or start typing</p>
      )}

      {testState === 'running' && (
        <div className="flex justify-end mb-1">
          <span className={`text-xs font-mono ${
            difficultyLevel >= 4 ? 'text-red-400' :
            difficultyLevel >= 3 ? 'text-orange-400' :
            difficultyLevel >= 2 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {DIFFICULTY_LABELS[difficultyLevel]}
          </span>
        </div>
      )}

      {focusPatterns.length > 0 && testState !== 'idle' && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-xs text-gray-500">focusing on:</span>
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
                      className={`w-2 h-1.5 rounded-sm ${i < streak ? 'bg-yellow-400' : 'bg-gray-700'}`}
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
        />
      </div>
    </div>
  );
}
