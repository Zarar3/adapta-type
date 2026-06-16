import { useEffect, useRef } from 'react';
import type { CharState } from '../../types';

interface LineProps {
  words: string[];
  charStates: CharState[][];
  isActive: boolean;
  activeWord: number;
  activeChar: number;
  showHint?: boolean;
}

const stateClass: Record<CharState, string> = {
  untyped: 'text-gray-400 dark:text-gray-500',
  correct: 'text-gray-700 dark:text-gray-200',
  incorrect: 'text-red-400',
  extra: 'text-red-600',
};

export function WordDisplay({ words, charStates, isActive, activeWord, activeChar, showHint }: LineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    const caret = caretRef.current;
    if (!container || !caret) return;

    const clampedChar = Math.min(activeChar, words[activeWord]?.length ?? 0);
    const el = charRefs.current.get(`${activeWord}-${clampedChar}`);
    if (!el) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    caret.style.left = `${elRect.left - containerRect.left - 1}px`;
    caret.style.top = `${elRect.top - containerRect.top}px`;
    caret.style.height = `${elRect.height}px`;
  }, [isActive, activeWord, activeChar, words]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4 transition-opacity duration-150 leading-relaxed ${isActive ? 'opacity-100' : 'opacity-30'}`}
    >
      {isActive && (
        <div
          ref={caretRef}
          className="absolute w-0.5 bg-yellow-400 pointer-events-none animate-blink"
          style={{ transition: 'left 0.08s ease-out, top 0.08s ease-out' }}
        />
      )}

      {words.map((word, wi) => {
        // Position 2 gets a content-based key so it remounts when a new word arrives, triggering the entry animation.
        // Positions 0 and 1 use stable slot keys so they update in-place without animation.
        const wordKey = wi === 2 ? `word-2-${word}` : `word-${wi}`;
        return (
          <span
            key={wordKey}
            className={`font-mono text-xl sm:text-3xl tracking-wide ${wi === 2 ? 'animate-slide-in-right' : ''}`}
          >
            {word.split('').map((char, ci) => (
              <span
                key={ci}
                ref={el => {
                  const k = `${wi}-${ci}`;
                  if (el) charRefs.current.set(k, el);
                  else charRefs.current.delete(k);
                }}
                className={stateClass[charStates[wi]?.[ci] ?? 'untyped']}
              >
                {char}
              </span>
            ))}
            {/* Zero-width ghost span gives the caret a valid position after the last character */}
            <span
              ref={el => {
                const k = `${wi}-${word.length}`;
                if (el) charRefs.current.set(k, el);
                else charRefs.current.delete(k);
              }}
              aria-hidden="true"
            >&#8203;</span>
          </span>
        );
      })}

      {showHint && (
        <span className="inline-flex flex-col items-center self-center -ml-4">
          <span className="text-yellow-400 text-2xl leading-none animate-bounce-x">→</span>
          <span className="text-gray-400 dark:text-gray-600 text-xs mt-0.5">space</span>
        </span>
      )}
    </div>
  );
}
