import { useEffect, useRef } from 'react';
import type { CharState } from '../../types';

export interface WordFlags {
  golden: number | null;
  bomb: number | null;
  freeze: number | null;
  bombCountdown: number;
}

interface LineProps {
  words: string[];
  charStates: CharState[][];
  isActive: boolean;
  activeWord: number;
  activeChar: number;
  showHint?: boolean;
  wordFlags?: WordFlags | null;
}

const stateClass: Record<CharState, string> = {
  untyped: 'text-gray-400 dark:text-gray-500',
  correct: 'text-gray-700 dark:text-gray-200',
  incorrect: 'text-red-400',
  extra: 'text-red-600',
};

export function WordDisplay({ words, charStates, isActive, activeWord, activeChar, showHint, wordFlags }: LineProps) {
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

  // Centering the row makes it re-flow on every completed word, since its width is the
  // sum of three varying word widths — so the active word drifts sideways as you type.
  // Instead the row is anchored: its left edge sits 12ch left of centre, which is where
  // an average three-word row's left edge landed anyway, and the words flow right from
  // there at their natural widths. The active word is now pinned, spacing stays uniform,
  // and the row still reads as centred. `ch` needs the mono font on this element to
  // resolve to a character width, hence font-mono/text-* here as well as on the words.
  return (
    <div
      ref={containerRef}
      className={`relative font-mono text-xl sm:text-3xl flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4 sm:flex-nowrap sm:justify-start sm:ml-[calc(50%-12ch)] transition-opacity duration-150 leading-relaxed ${isActive ? 'opacity-100' : 'opacity-30'}`}
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

        const isGolden = wordFlags?.golden === wi;
        const isBomb   = wordFlags?.bomb === wi;
        const isFreeze = wordFlags?.freeze === wi;
        const isSpecial = isGolden || isBomb || isFreeze;
        const isCombo = (Number(isGolden) + Number(isBomb) + Number(isFreeze)) >= 2;
        const isBombActive = isBomb && wi === 0; // bomb countdown only shown at slot 0

        // Compose styling. Text color follows a priority (bomb > golden > freeze) so it
        // stays legible; rings/glows from the other active flags layer on top, and combos
        // get an extra outline so they read as "this word is more than one thing".
        const textColor = isBomb ? 'text-red-500 font-bold' : isGolden ? 'text-yellow-400' : isFreeze ? 'text-sky-300' : '';
        const glow = isBomb
          ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse'
          : isGolden ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : '';

        return (
          <span
            key={wordKey}
            className={[
              // shrink-0: with flex-nowrap a long word would otherwise be squeezed and
              // break across lines mid-word.
              'font-mono text-xl sm:text-3xl tracking-wide relative shrink-0',
              wi === 2 ? 'animate-slide-in-right' : '',
              textColor,
              glow,
              isFreeze ? 'ring-1 ring-sky-400/50 rounded px-1' : '',
              isCombo ? 'rounded px-1 ring-2 ring-fuchsia-400/70 bg-fuchsia-400/5 drop-shadow-[0_0_10px_rgba(217,70,239,0.6)]' : '',
            ].filter(Boolean).join(' ')}
          >
            {/* Special-word badge: icons for each active effect, plus bomb countdown */}
            {isSpecial && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs font-mono font-bold select-none whitespace-nowrap">
                {isGolden && <span className="text-yellow-400">✦</span>}
                {isFreeze && <span className="text-sky-300">❄</span>}
                {isBomb && <span className="text-red-400 animate-pulse">✸</span>}
                {isBombActive && wordFlags!.bombCountdown > 0 && (
                  <span className="text-red-400 animate-pulse">{wordFlags!.bombCountdown}s</span>
                )}
              </span>
            )}
            {word.split('').map((char, ci) => (
              <span
                key={ci}
                ref={el => {
                  const k = `${wi}-${ci}`;
                  if (el) charRefs.current.set(k, el);
                  else charRefs.current.delete(k);
                }}
                className={
                // Untyped chars in special words inherit the word's glow color.
                // Typed chars always show correct/incorrect feedback regardless.
                (isGolden || isBomb || isFreeze) && (charStates[wi]?.[ci] ?? 'untyped') === 'untyped'
                  ? undefined
                  : stateClass[charStates[wi]?.[ci] ?? 'untyped']
              }
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
